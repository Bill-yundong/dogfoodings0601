import multiprocessing
import os
import random
import threading
import time
from typing import List, Optional

from config import DEFAULT_LOCK_NAMES, MAX_TASK_RETRIES, WAIT_TIMEOUT
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
                        f"Received ROLLBACK signal, releasing all locks"
                    )
                    self.lock_manager.release_all()
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
            task_success = False
            final_was_rollback = False

            for attempt in range(MAX_TASK_RETRIES + 1):
                if attempt > 0:
                    reason = "rollback" if final_was_rollback else "timeout"
                    logger.info(
                        f"[{process_name}] Retrying task {task_id} after {reason} "
                        f"(attempt {attempt + 1}/{MAX_TASK_RETRIES + 1})"
                    )
                    lock_manager.clear_rollback()
                    final_was_rollback = False
                    time.sleep(0.2 * attempt)
                elif lock_manager.is_rollback_requested():
                    lock_manager.clear_rollback()

                logger.info(
                    f"[{process_name}] Starting task {task_id}, "
                    f"need {num_locks} lock(s)"
                )

                selected_locks = random.sample(DEFAULT_LOCK_NAMES, num_locks)
                random.shuffle(selected_locks)

                acquired_locks = []
                acquire_failed = False
                rollback_this_attempt = False

                for lock_name in selected_locks:
                    if lock_manager.is_rollback_requested():
                        rollback_this_attempt = True
                        acquire_failed = True
                        break

                    handle = lock_manager.lock(lock_name, timeout=WAIT_TIMEOUT)
                    if not handle.acquired:
                        if lock_manager.is_rollback_requested():
                            rollback_this_attempt = True
                        acquire_failed = True
                        break

                    acquired_locks.append(handle)
                    time.sleep(random.uniform(0.05, 0.15))

                if acquire_failed:
                    if not rollback_this_attempt:
                        for handle in reversed(acquired_locks):
                            try:
                                handle.release()
                            except Exception:
                                pass
                    acquired_locks = []

                    if attempt < MAX_TASK_RETRIES:
                        final_was_rollback = rollback_this_attempt
                        logger.warning(
                            f"[{process_name}] Task {task_id} attempt {attempt + 1} "
                            f"failed ({'rollback' if rollback_this_attempt else 'timeout'}), "
                            f"will retry"
                        )
                        continue
                    final_was_rollback = rollback_this_attempt
                    break

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

                total_work = random.uniform(0.2, 0.5)
                logger.info(
                    f"[{process_name}] Holding {len(acquired_locks)} lock(s) "
                    f"for task {task_id}, working for {total_work:.2f}s"
                )

                step_time = total_work / 5
                rollback_during_work = False
                for i in range(5):
                    if lock_manager.is_rollback_requested():
                        rollback_during_work = True
                        break
                    time.sleep(step_time)

                if not rollback_during_work:
                    for handle in reversed(acquired_locks):
                        try:
                            handle.release()
                        except Exception as e:
                            logger.error(
                                f"[{process_name}] Error releasing "
                                f"'{handle.lock_name}': {e}"
                            )

                if rollback_during_work:
                    if attempt < MAX_TASK_RETRIES:
                        final_was_rollback = True
                        logger.warning(
                            f"[{process_name}] Task {task_id} attempt {attempt + 1} "
                            f"rolled back during work, will retry"
                        )
                        continue
                    final_was_rollback = True
                    break

                task_success = True
                break

            if task_success:
                completed += 1
                result_queue.put((task_id, "success", process_name))
                logger.info(
                    f"[{process_name}] Completed task {task_id} successfully"
                )
            elif final_was_rollback:
                rollback_count += 1
                result_queue.put((task_id, "rollback", process_name))
                logger.warning(
                    f"[{process_name}] Task {task_id} exhausted all "
                    f"{MAX_TASK_RETRIES + 1} attempts (rollback)"
                )
                lock_manager.clear_rollback()
            else:
                failed += 1
                result_queue.put((task_id, "failed", process_name))
                logger.warning(
                    f"[{process_name}] Task {task_id} exhausted all "
                    f"{MAX_TASK_RETRIES + 1} attempts (timeout)"
                )

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
