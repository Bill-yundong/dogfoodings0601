import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "locks.db")

LOCK_TIMEOUT = 5.0
HEARTBEAT_INTERVAL = 2.0
DEADLOCK_DETECT_INTERVAL = 3.0
WAIT_TIMEOUT = 15.0
MAX_RETRY = 3
RETRY_DELAY = 0.1
MAX_TASK_RETRIES = 3

NUM_LOCKS = 5
DEFAULT_LOCK_NAMES = [f"resource_{i}" for i in range(NUM_LOCKS)]

LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s | %(processName)-12s | %(levelname)-7s | %(message)s"
