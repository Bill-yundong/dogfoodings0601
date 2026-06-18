import sqlite3
import threading
import time
from contextlib import contextmanager

from config import DB_PATH

_db_local = threading.local()


def _get_conn():
    if not hasattr(_db_local, "conn"):
        _db_local.conn = sqlite3.connect(DB_PATH, timeout=30.0, isolation_level=None)
        _db_local.conn.execute("PRAGMA journal_mode=WAL")
        _db_local.conn.execute("PRAGMA busy_timeout=30000")
        _db_local.conn.row_factory = sqlite3.Row
    return _db_local.conn


@contextmanager
def get_cursor():
    conn = _get_conn()
    cursor = conn.cursor()
    try:
        yield cursor
    finally:
        cursor.close()


def init_db():
    with get_cursor() as cur:
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS locks (
                lock_name TEXT PRIMARY KEY,
                holder_pid INTEGER,
                holder_name TEXT,
                reentrant_count INTEGER DEFAULT 0,
                acquired_at REAL,
                last_heartbeat REAL,
                priority INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS wait_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lock_name TEXT NOT NULL,
                waiter_pid INTEGER NOT NULL,
                waiter_name TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                requested_at REAL,
                FOREIGN KEY (lock_name) REFERENCES locks(lock_name)
            );

            CREATE TABLE IF NOT EXISTS deadlock_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detected_at REAL,
                cycle TEXT,
                victim_pid INTEGER,
                victim_name TEXT,
                rollback_result TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_wait_queue_lock ON wait_queue(lock_name);
            CREATE INDEX IF NOT EXISTS idx_wait_queue_waiter ON wait_queue(waiter_pid);
            """
        )


def clear_db():
    with get_cursor() as cur:
        cur.executescript(
            """
            DELETE FROM locks;
            DELETE FROM wait_queue;
            """
        )


def upsert_lock(lock_name, holder_pid, holder_name, priority):
    now = time.time()
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO locks (lock_name, holder_pid, holder_name, reentrant_count,
                              acquired_at, last_heartbeat, priority)
            VALUES (?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(lock_name) DO UPDATE SET
                holder_pid=excluded.holder_pid,
                holder_name=excluded.holder_name,
                reentrant_count=locks.reentrant_count + 1,
                last_heartbeat=excluded.last_heartbeat,
                priority=excluded.priority
            WHERE locks.holder_pid = excluded.holder_pid
            """,
            (lock_name, holder_pid, holder_name, now, now, priority),
        )
        return cur.rowcount > 0


def update_heartbeat(lock_name, holder_pid):
    now = time.time()
    with get_cursor() as cur:
        cur.execute(
            "UPDATE locks SET last_heartbeat = ? WHERE lock_name = ? AND holder_pid = ?",
            (now, lock_name, holder_pid),
        )
        return cur.rowcount > 0


def release_lock(lock_name, holder_pid):
    with get_cursor() as cur:
        cur.execute(
            "SELECT reentrant_count FROM locks WHERE lock_name = ? AND holder_pid = ?",
            (lock_name, holder_pid),
        )
        row = cur.fetchone()
        if not row:
            return False, 0

        count = row["reentrant_count"]
        if count > 1:
            cur.execute(
                "UPDATE locks SET reentrant_count = reentrant_count - 1 WHERE lock_name = ? AND holder_pid = ?",
                (lock_name, holder_pid),
            )
            return True, count - 1
        else:
            cur.execute("DELETE FROM locks WHERE lock_name = ? AND holder_pid = ?", (lock_name, holder_pid))
            return True, 0


def get_lock_info(lock_name):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM locks WHERE lock_name = ?", (lock_name,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_all_locks():
    with get_cursor() as cur:
        cur.execute("SELECT * FROM locks")
        return [dict(r) for r in cur.fetchall()]


def add_waiter(lock_name, waiter_pid, waiter_name, priority):
    now = time.time()
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO wait_queue (lock_name, waiter_pid, waiter_name, priority, requested_at) VALUES (?, ?, ?, ?, ?)",
            (lock_name, waiter_pid, waiter_name, priority, now),
        )
        return cur.lastrowid


def remove_waiter(lock_name, waiter_pid):
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM wait_queue WHERE lock_name = ? AND waiter_pid = ?",
            (lock_name, waiter_pid),
        )
        return cur.rowcount > 0


def remove_waiter_by_pid(waiter_pid):
    with get_cursor() as cur:
        cur.execute("DELETE FROM wait_queue WHERE waiter_pid = ?", (waiter_pid,))
        return cur.rowcount


def get_wait_queue(lock_name=None):
    with get_cursor() as cur:
        if lock_name:
            cur.execute("SELECT * FROM wait_queue WHERE lock_name = ? ORDER BY requested_at", (lock_name,))
        else:
            cur.execute("SELECT * FROM wait_queue ORDER BY requested_at")
        return [dict(r) for r in cur.fetchall()]


def get_waiting_processes():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT w.waiter_pid, w.waiter_name, w.lock_name, w.priority, l.holder_pid, l.holder_name
            FROM wait_queue w
            JOIN locks l ON w.lock_name = l.lock_name
            """
        )
        return [dict(r) for r in cur.fetchall()]


def force_release_lock(lock_name):
    with get_cursor() as cur:
        cur.execute("DELETE FROM locks WHERE lock_name = ?", (lock_name,))
        return cur.rowcount > 0


def release_all_locks_by_pid(pid):
    with get_cursor() as cur:
        cur.execute("DELETE FROM locks WHERE holder_pid = ?", (pid,))
        removed = cur.rowcount
        cur.execute("DELETE FROM wait_queue WHERE waiter_pid = ?", (pid,))
        return removed


def log_deadlock(cycle, victim_pid, victim_name, result):
    now = time.time()
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO deadlock_log (detected_at, cycle, victim_pid, victim_name, rollback_result) VALUES (?, ?, ?, ?, ?)",
            (now, cycle, victim_pid, victim_name, result),
        )
        return cur.lastrowid


def cleanup_expired_locks(timeout):
    cutoff = time.time() - timeout
    with get_cursor() as cur:
        cur.execute("SELECT lock_name, holder_pid, holder_name FROM locks WHERE last_heartbeat < ?", (cutoff,))
        expired = [dict(r) for r in cur.fetchall()]
        if expired:
            cur.execute("DELETE FROM locks WHERE last_heartbeat < ?", (cutoff,))
            for e in expired:
                cur.execute("DELETE FROM wait_queue WHERE waiter_pid = ?", (e["holder_pid"],))
        return expired
