import argparse
import multiprocessing
import os
import random
import signal
import sys
import time

from config import DB_PATH, DEFAULT_LOCK_NAMES, NUM_LOCKS
from deadlock_detector import DeadlockDetector
from logger import get_logger, setup_main_process_logger, stop_logger
from models import clear_db, init_db
from worker import worker_process


def parse_args():
    parser = argparse.ArgumentParser(
        description="Multi-process distributed lock manager with deadlock detection"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Number of worker processes (default: 8)",
    )
    parser.add_argument(
        "--tasks",
        type=int,
        default=50,
        help="Total number of tasks to process (default: 50)",
    )
    parser.add_argument(
        "--locks",
        type=int,
        default=NUM_LOCKS,
        help=f"Number of available locks (default: {NUM_LOCKS})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducibility",
    )
    return parser.parse_args()


def signal_handler(signum, frame):
    logger = get_logger()
    logger.warning(f"Received signal {signum}, shutting down...")
    stop_logger()
    sys.exit(1)


def main():
    args = parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    init_db()
    clear_db()

    log_queue = multiprocessing.Queue(-1)
    logger = setup_main_process_logger(log_queue)
    logger.info("=" * 80)
    logger.info(
        f"Starting lock manager simulation: workers={args.workers}, "
        f"tasks={args.tasks}, locks={args.locks}"
    )
    logger.info(f"Available locks: {DEFAULT_LOCK_NAMES[:args.locks]}")
    logger.info("=" * 80)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    task_queue = multiprocessing.Queue()
    result_queue = multiprocessing.Queue()
    rollback_queues = {}

    logger.info("Generating tasks...")
    for task_id in range(args.tasks):
        num_locks = random.randint(1, min(3, args.locks))
        task_queue.put((task_id, num_locks))
        if (task_id + 1) % 10 == 0:
            logger.info(f"  Generated {task_id + 1}/{args.tasks} tasks")

    for _ in range(args.workers):
        task_queue.put(None)

    logger.info(f"Starting {args.workers} worker processes...")

    rollback_queues = {}
    processes = []
    for worker_id in range(args.workers):
        rb_queue = multiprocessing.Queue()
        priority = args.workers - worker_id
        p = multiprocessing.Process(
            target=worker_process,
            args=(worker_id, task_queue, result_queue, rb_queue, log_queue, priority),
            name=f"Worker-{worker_id}",
        )
        processes.append(p)
        rollback_queues[worker_id] = rb_queue
        p.daemon = True
        p.start()
        logger.info(f"  Worker-{worker_id} started with PID {p.pid}, priority={priority}")
        rollback_queues[p.pid] = rb_queue

    actual_pid_map = {}
    for worker_id, p in enumerate(processes):
        actual_pid_map[p.pid] = worker_id

    detector = DeadlockDetector(rollback_queues)
    detector.start()

    logger.info("All systems started. Waiting for task completion...")
    logger.info("-" * 80)

    start_time = time.time()
    results = {"success": 0, "failed": 0, "rollback": 0}
    worker_summaries = {}
    received_summaries = 0

    while received_summaries < args.workers:
        try:
            result = result_queue.get(timeout=1.0)
            task_id, status, worker_name = result

            if task_id == "SUMMARY":
                completed, failed, rollbacks = status
                worker_summaries[worker_name] = {
                    "completed": completed,
                    "failed": failed,
                    "rollbacks": rollbacks,
                }
                received_summaries += 1
                logger.info(
                    f"[{worker_name}] Summary: completed={completed}, "
                    f"failed={failed}, rollbacks={rollbacks}"
                )
            else:
                results[status] += 1
                total_done = results["success"] + results["failed"] + results["rollback"]
                if total_done % 5 == 0 or total_done == args.tasks:
                    logger.info(
                        f"Progress: {total_done}/{args.tasks} tasks done "
                        f"(success={results['success']}, failed={results['failed']}, "
                        f"rollback={results['rollback']})"
                    )
        except Exception as e:
            logger.debug(f"Waiting for results... {e}")

    logger.info("-" * 80)
    logger.info("All tasks processed. Waiting for workers to exit...")

    for p in processes:
        p.join(timeout=5.0)
        if p.is_alive():
            logger.warning(f"Worker {p.name} (pid={p.pid}) did not exit cleanly, terminating")
            p.terminate()
            p.join(timeout=2.0)

    detector.stop()
    elapsed = time.time() - start_time

    detector_stats = detector.get_stats()

    logger.info("=" * 80)
    logger.info("SIMULATION COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total time: {elapsed:.2f}s")
    logger.info(f"Tasks processed: {sum(results.values())}/{args.tasks}")
    logger.info(f"  - Success: {results['success']}")
    logger.info(f"  - Failed: {results['failed']}")
    logger.info(f"  - Rollback: {results['rollback']}")
    logger.info("")
    logger.info("Deadlock detector stats:")
    logger.info(f"  - Detection scans: {detector_stats['detection_count']}")
    logger.info(f"  - Deadlocks found: {detector_stats['deadlock_count']}")
    logger.info("")
    logger.info("Worker summaries:")
    for worker_name, summary in sorted(worker_summaries.items()):
        logger.info(
            f"  {worker_name}: completed={summary['completed']}, "
            f"failed={summary['failed']}, rollbacks={summary['rollbacks']}"
        )
    logger.info("=" * 80)

    stop_logger()

    return 0 if results["failed"] == 0 else 1


if __name__ == "__main__":
    try:
        multiprocessing.set_start_method("spawn")
    except RuntimeError:
        pass
    sys.exit(main())
