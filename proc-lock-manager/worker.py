import multiprocessing
import os
import random
import threading
import time
from typing import List, Optional

from config import DEFAULT_LOCK_NAMES, WAIT_TIMEOUT
from lock_manager import LockManager
from logger import get_logger, setup_worker_logger


class RollbackListener(threading.Thread):
    def __init__(self, rollback_queue: "multiprocessing.Queue", lock_manager: LockManager):
        super().__init__(daemon=True)
        self.rollback_queue = rollback_queue
        self.lock_manager = lock_manager
        self.logger = get_logger()
        self._stop_event = threading.Event()

    def stop(self):
        self._stop_event.set()

    def run(self):
        while not self._stop_event.is_set():
            try:
                msg = self.rollback_queue.get(timeout=0.5)
                if msg == "ROLLBACK":
                    self.lock_manager.request_rollback()
                    self.logger.warning(
                        f"[{self.lock_manager.process_name}] "
                        f"Received ROLLBACK signal, flag set for worker to handle release"
                    )
            except multiprocessing.queues.Empty:
                continue
            except Exception as e:
                self.logger.error(f"Rollback listener error: {e}")


def worker_process(
    worker_id: int,
    task_queue: "multiprocessing.Queue",
    result_queue: "multiprocessing.Queue",
    rollback_queue: "multiprocessing.Queue",
    log_queue: "multiprocessing.Queue",
    priority: int = 0,
):
    setup_worker_logger(log_queue)
    logger = get_logger()

    process_name = f"Worker-{worker_id}"
    lock_manager = LockManager(process_name=process_name, priority=priority)
    lock_manager.start_heartbeat()

    rollback_listener = RollbackListener(rollback_queue, lock_manager)
    rollback_listener.start()

    logger.info(f"[{process_name}] Started (pid={os.getpid()}, priority={priority})")

    completed = 0
    failed = 0
    rollback_count = 0

    while True:
        try:
            task = task_queue.get(timeout=1.0)
            if task is None:
                break

            task_id, num_locks = task

            if lock_manager.is_rollback_requested():
                logger.warning(
                    f"[{process_name}] Rollback flag set before task {task_id}, "
                    f"clearing flag and proceeding"
                )
                lock_manager.clear_rollback()

            logger.info(
                f"[{process_name}] Starting task {task_id}, "
                f"need {num_locks} lock(s)"
            )

            selected_locks = random.sample(DEFAULT_LOCK_NAMES, num_locks)
            selected_locks.sort()

            acquired_locks = []
            task_success = True
            rollback_occurred = False

            max_attempts = 2
            for attempt in range(1, max_attempts + 1):
                acquired_locks = []
                rollback_occurred = False
                attempt_success = True

                for lock_name in selected_locks:
                    if lock_manager.is_rollback_requested():
                        logger.warning(
                            f"[{process_name}] Rollback requested during "
                            f"task {task_id} (attempt {attempt}/{max_attempts})"
                        )
                        rollback_occurred = True
                        attempt_success = False
                        break

                    handle = lock_manager.lock(lock_name, timeout=WAIT_TIMEOUT)
                    if not handle.acquired:
                        logger.warning(
                            f"[{process_name}] Failed to acquire '{lock_name}' for "
                            f"task {task_id} (attempt {attempt}/{max_attempts}), "
                            f"releasing held locks and backing off"
                        )
                        attempt_success = False
                        break

                    acquired_locks.append(handle)
                    time.sleep(random.uniform(0.1, 0.5))

                if attempt_success:
                    task_success = True
                    break
                elif rollback_occurred:
                    task_success = False
                    break
                else:
                    for handle in reversed(acquired_locks):
                        try:
                            if handle.acquired:
                                handle.release()
                        except Exception as e:
                            logger.error(
                                f"[{process_name}] Error releasing '{handle.lock_name}' "
                                f"during backoff: {e}"
                            )
                    acquired_locks = []
                    if attempt < max_attempts:
                        backoff = random.uniform(0.2, 0.6)
                        logger.info(
                            f"[{process_name}] Backing off {backoff:.2f}s before "
                            f"retry attempt {attempt + 1}/{max_attempts} for task {task_id}"
                        )
                        time.sleep(backoff)
                    else:
                        task_success = False
                        logger.warning(
                            f"[{process_name}] All {max_attempts} attempts failed "
                            f"for task {task_id}, giving up"
                        )

            if task_success and acquired_locks:
                if random.random() < 0.15:
                    first_lock = acquired_locks[0]
                    logger.info(
                        f"[{process_name}] Testing reentrancy on "
                        f"'{first_lock.lock_name}' for task {task_id}"
                    )
                    reentrant_handle = lock_manager.lock(first_lock.lock_name)
                    if reentrant_handle.acquired:
                        time.sleep(0.1)
                        reentrant_handle.release()

                total_work = random.uniform(0.3, 1.0)
                logger.info(
                    f"[{process_name}] Holding {len(acquired_locks)} lock(s) "
                    f"for task {task_id}, working for {total_work:.2f}s"
                )

                step_time = total_work / 5
                for i in range(5):
                    if lock_manager.is_rollback_requested():
                        logger.warning(
                            f"[{process_name}] Rollback during work step "
                            f"{i + 1}/5 for task {task_id}"
                        )
                        task_success = False
                        rollback_occurred = True
                        break
                    time.sleep(step_time)

            if rollback_occurred and acquired_locks:
                logger.warning(
                    f"[{process_name}] Explicitly releasing {len(acquired_locks)} "
                    f"lock(s) after rollback for task {task_id}"
                )
                for handle in reversed(acquired_locks):
                    try:
                        if handle.acquired:
                            handle.release()
                    except Exception as e:
                        logger.error(
                            f"[{process_name}] Error releasing '{handle.lock_name}' "
                            f"during rollback cleanup: {e}"
                        )
            elif not rollback_occurred:
                for handle in reversed(acquired_locks):
                    try:
                        if handle.acquired:
                            handle.release()
                    except Exception as e:
                        logger.error(
                            f"[{process_name}] Error releasing '{handle.lock_name}': {e}"
                        )

            if task_success:
                completed += 1
                result_queue.put((task_id, "success", process_name))
                logger.info(
                    f"[{process_name}] Completed task {task_id} successfully"
                )
            elif rollback_occurred:
                rollback_count += 1
                result_queue.put((task_id, "rollback", process_name))
                logger.warning(
                    f"[{process_name}] Task {task_id} rolled back"
                )
                lock_manager.clear_rollback()
            else:
                failed += 1
                result_queue.put((task_id, "failed", process_name))

        except multiprocessing.queues.Empty:
            continue
        except Exception as e:
            logger.error(f"[{process_name}] Unexpected error: {e}", exc_info=True)
            failed += 1

    rollback_listener.stop()
    rollback_listener.join(timeout=2.0)
    lock_manager.stop_heartbeat()
    lock_manager.release_all()

    logger.info(
        f"[{process_name}] Exiting. Completed={completed}, "
        f"Failed={failed}, Rollbacks={rollback_count}"
    )
    result_queue.put(("SUMMARY", (completed, failed, rollback_count), process_name))
