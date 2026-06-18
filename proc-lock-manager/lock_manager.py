import multiprocessing
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Optional, Set

import models
from config import HEARTBEAT_INTERVAL, LOCK_TIMEOUT, MAX_RETRY, RETRY_DELAY, WAIT_TIMEOUT
from logger import get_logger


@dataclass
class LockHandle:
    lock_name: str
    acquired: bool = False
    reentrant_count: int = 0
    _manager: "LockManager" = field(default=None, repr=False)

    def release(self):
        if self._manager and self.acquired:
            return self._manager.unlock(self.lock_name)
        return False, 0


class LockManager:
    def __init__(self, process_name: Optional[str] = None, priority: int = 0):
        self.pid = os.getpid()
        self.process_name = process_name or f"Process-{self.pid}"
        self.priority = priority
        self.logger = get_logger()
        self._held_locks: Set[str] = set()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._heartbeat_stop = threading.Event()
        self._rollback_requested = threading.Event()
        self._lock = threading.Lock()

    def start_heartbeat(self):
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            return
        self._heartbeat_stop.clear()
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_worker,
            name=f"Heartbeat-{self.process_name}",
            daemon=True,
        )
        self._heartbeat_thread.start()
        self.logger.debug(f"[{self.process_name}] Heartbeat thread started")

    def stop_heartbeat(self):
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_stop.set()
            self._heartbeat_thread.join(timeout=2.0)
            self.logger.debug(f"[{self.process_name}] Heartbeat thread stopped")

    def _heartbeat_worker(self):
        while not self._heartbeat_stop.is_set():
            try:
                with self._lock:
                    current_locks = list(self._held_locks)
                for lock_name in current_locks:
                    if not models.update_heartbeat(lock_name, self.pid):
                        with self._lock:
                            if lock_name in self._held_locks:
                                self._held_locks.discard(lock_name)
                                self.logger.warning(
                                    f"[{self.process_name}] Lost lock '{lock_name}' during heartbeat"
                                )
            except Exception as e:
                self.logger.error(f"[{self.process_name}] Heartbeat error: {e}")
            self._heartbeat_stop.wait(HEARTBEAT_INTERVAL)

    def request_rollback(self):
        self._rollback_requested.set()
        self.logger.warning(f"[{self.process_name}] Rollback requested by deadlock detector")

    def is_rollback_requested(self) -> bool:
        return self._rollback_requested.is_set()

    def clear_rollback(self):
        self._rollback_requested.clear()
        self.logger.info(f"[{self.process_name}] Rollback flag cleared, ready for new tasks")

    def lock(self, lock_name: str, timeout: Optional[float] = None) -> LockHandle:
        timeout = timeout if timeout is not None else WAIT_TIMEOUT
        handle = LockHandle(lock_name=lock_name, _manager=self)
        start_time = time.time()
        retry_count = 0

        while True:
            if self._rollback_requested.is_set():
                self.logger.warning(
                    f"[{self.process_name}] Aborting lock request for '{lock_name}' due to rollback"
                )
                return handle

            elapsed = time.time() - start_time
            if elapsed >= timeout:
                self.logger.warning(
                    f"[{self.process_name}] Timeout waiting for lock '{lock_name}' after {elapsed:.1f}s"
                )
                models.remove_waiter(lock_name, self.pid)
                return handle

            lock_info = models.get_lock_info(lock_name)

            if lock_info is None:
                if models.upsert_lock(lock_name, self.pid, self.process_name, self.priority):
                    models.remove_waiter(lock_name, self.pid)
                    with self._lock:
                        self._held_locks.add(lock_name)
                    handle.acquired = True
                    handle.reentrant_count = 1
                    self.logger.info(
                        f"[{self.process_name}] ACQUIRED lock '{lock_name}' (reentrant_count=1)"
                    )
                    return handle
            elif lock_info["holder_pid"] == self.pid:
                if models.upsert_lock(lock_name, self.pid, self.process_name, self.priority):
                    models.remove_waiter(lock_name, self.pid)
                    handle.acquired = True
                    handle.reentrant_count = lock_info["reentrant_count"] + 1
                    self.logger.info(
                        f"[{self.process_name}] REENTRANT lock '{lock_name}' (count={handle.reentrant_count})"
                    )
                    return handle
            else:
                wait_queue = models.get_wait_queue(lock_name)
                already_waiting = any(w["waiter_pid"] == self.pid for w in wait_queue)
                if not already_waiting:
                    models.add_waiter(lock_name, self.pid, self.process_name, self.priority)
                    self.logger.debug(
                        f"[{self.process_name}] Added to wait queue for '{lock_name}', "
                        f"held by {lock_info['holder_name']} (pid={lock_info['holder_pid']})"
                    )

            retry_count += 1
            if retry_count >= MAX_RETRY:
                sleep_time = min(0.5, RETRY_DELAY * (2 ** (retry_count - MAX_RETRY)))
            else:
                sleep_time = RETRY_DELAY
            time.sleep(sleep_time)

    def unlock(self, lock_name: str):
        with self._lock:
            if lock_name not in self._held_locks:
                self.logger.warning(
                    f"[{self.process_name}] Attempted to release unheld lock '{lock_name}'"
                )
                return False, 0

        success, remaining = models.release_lock(lock_name, self.pid)
        if success:
            if remaining == 0:
                with self._lock:
                    self._held_locks.discard(lock_name)
                self.logger.info(
                    f"[{self.process_name}] RELEASED lock '{lock_name}' (fully released)"
                )
            else:
                self.logger.info(
                    f"[{self.process_name}] DECREMENTED lock '{lock_name}' (remaining={remaining})"
                )
        return success, remaining

    def release_all(self):
        with self._lock:
            current_locks = list(self._held_locks)

        for lock_name in current_locks:
            try:
                self.unlock(lock_name)
            except Exception as e:
                self.logger.error(
                    f"[{self.process_name}] Error releasing lock '{lock_name}': {e}"
                )

        models.release_all_locks_by_pid(self.pid)
        with self._lock:
            self._held_locks.clear()
        self.logger.info(f"[{self.process_name}] All locks released")

    def cleanup_expired(self) -> list:
        expired = models.cleanup_expired_locks(LOCK_TIMEOUT)
        for e in expired:
            self.logger.warning(
                f"[{self.process_name}] Cleaned up expired lock '{e['lock_name']}' "
                f"from {e['holder_name']} (pid={e['holder_pid']})"
            )
        return expired

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop_heartbeat()
        self.release_all()
        return False
