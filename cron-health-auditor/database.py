"""SQLite persistence layer for the cron health auditor.

All scan results, validation outcomes, syslog-derived execution records
and generated reports are stored here so that historical comparisons can
be made across multiple runs.
"""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Iterable, Optional

from models import (
    ExecutionRecord,
    ReportRecord,
    TaskEntry,
    TaskStats,
    TaskStatus,
    ValidationResult,
)

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "cron_audit.db"
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id         TEXT NOT NULL,
    source          TEXT NOT NULL,
    user            TEXT,
    cron_expression TEXT NOT NULL,
    command         TEXT NOT NULL,
    script_path     TEXT,
    minute          TEXT,
    hour            TEXT,
    day             TEXT,
    month           TEXT,
    weekday         TEXT,
    line_number     INTEGER,
    fingerprint     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validations (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id               TEXT NOT NULL,
    task_fingerprint      TEXT NOT NULL,
    cron_expression_valid INTEGER NOT NULL,
    cron_expression_errors TEXT,
    script_exists         INTEGER,
    is_executable         INTEGER,
    permission_octal      TEXT,
    issues                TEXT,
    status                TEXT NOT NULL,
    created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id             TEXT,
    timestamp           TEXT,
    user                TEXT,
    command             TEXT,
    pid                 INTEGER,
    success             INTEGER,
    duration            REAL,
    matched_fingerprint TEXT,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_stats (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id       TEXT NOT NULL,
    fingerprint   TEXT NOT NULL,
    total_runs    INTEGER,
    success_count INTEGER,
    failure_count INTEGER,
    success_rate  REAL,
    avg_duration  REAL,
    last_run      TEXT,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id              TEXT NOT NULL,
    created_at           TEXT NOT NULL,
    total_tasks          INTEGER,
    healthy_tasks        INTEGER,
    warning_tasks        INTEGER,
    error_tasks          INTEGER,
    overall_health_score REAL,
    details_json         TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_scan        ON tasks(scan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_fp          ON tasks(fingerprint);
CREATE INDEX IF NOT EXISTS idx_validations_scan  ON validations(scan_id);
CREATE INDEX IF NOT EXISTS idx_execlogs_ts       ON execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_stats_scan        ON task_stats(scan_id);
CREATE INDEX IF NOT EXISTS idx_reports_scan      ON reports(scan_id);
"""


class Database:
    """Thin wrapper around an SQLite connection.

    The database is created on first use.  Every scan is identified by a
    unique ``scan_id`` so that tasks, validations, logs and reports from
    the same run can be correlated.
    """

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    # ------------------------------------------------------------------ #
    # connection management
    # ------------------------------------------------------------------ #
    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
            self._conn.executescript(_SCHEMA)
            self._conn.commit()
        return self._conn

    def close(self) -> None:
        if self._conn is not None:
            self._conn.commit()
            self._conn.close()
            self._conn = None

    def __enter__(self) -> "Database":
        _ = self.conn
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def new_scan_id() -> str:
        return uuid.uuid4().hex[:12]

    @staticmethod
    def _now() -> str:
        return datetime.now().isoformat(timespec="seconds")

    # ------------------------------------------------------------------ #
    # write operations
    # ------------------------------------------------------------------ #
    def save_scan(
        self,
        scan_id: str,
        tasks: Iterable[TaskEntry],
        validations: Iterable[ValidationResult],
        execution_records: Iterable[ExecutionRecord],
        stats: Iterable[TaskStats],
    ) -> None:
        """Persist a complete scan in a single transaction."""
        c = self.conn
        now = self._now()

        for t in tasks:
            c.execute(
                """INSERT INTO tasks
                   (scan_id, source, user, cron_expression, command,
                    script_path, minute, hour, day, month, weekday,
                    line_number, fingerprint, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    scan_id, t.source, t.user, t.cron_expression, t.command,
                    t.script_path, t.minute, t.hour, t.day, t.month, t.weekday,
                    t.line_number, t.fingerprint(), now,
                ),
            )

        for v in validations:
            c.execute(
                """INSERT INTO validations
                   (scan_id, task_fingerprint, cron_expression_valid,
                    cron_expression_errors, script_exists, is_executable,
                    permission_octal, issues, status, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    scan_id, v.task.fingerprint(),
                    int(v.cron_expression_valid),
                    "; ".join(v.cron_expression_errors),
                    self._opt_bool(v.script_exists),
                    self._opt_bool(v.is_executable),
                    v.permission_octal,
                    "; ".join(v.issues),
                    v.status.value,
                    now,
                ),
            )

        for e in execution_records:
            c.execute(
                """INSERT INTO execution_logs
                   (scan_id, timestamp, user, command, pid, success,
                    duration, matched_fingerprint, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    scan_id,
                    e.timestamp.isoformat(timespec="seconds") if e.timestamp else None,
                    e.user, e.command, e.pid, int(e.success),
                    e.duration, None, now,
                ),
            )

        for s in stats:
            c.execute(
                """INSERT INTO task_stats
                   (scan_id, fingerprint, total_runs, success_count,
                    failure_count, success_rate, avg_duration, last_run,
                    created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    scan_id, s.fingerprint, s.total_runs, s.success_count,
                    s.failure_count, s.success_rate, s.avg_duration,
                    s.last_run.isoformat(timespec="seconds") if s.last_run else None,
                    now,
                ),
            )
        c.commit()

    def save_report(self, scan_id: str, report: ReportRecord) -> int:
        cur = self.conn.execute(
            """INSERT INTO reports
               (scan_id, created_at, total_tasks, healthy_tasks,
                warning_tasks, error_tasks, overall_health_score,
                details_json)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                scan_id, report.created_at.isoformat(timespec="seconds"),
                report.total_tasks, report.healthy_tasks,
                report.warning_tasks, report.error_tasks,
                report.overall_health_score,
                json.dumps(report.details, default=str, ensure_ascii=False),
            ),
        )
        self.conn.commit()
        return cur.lastrowid

    def update_execution_fingerprints(
        self, scan_id: str, mapping: dict
    ) -> None:
        """Update ``matched_fingerprint`` for stored execution records.

        ``mapping`` maps ``execution_logs.id`` -> fingerprint.
        """
        c = self.conn
        for log_id, fp in mapping.items():
            c.execute(
                "UPDATE execution_logs SET matched_fingerprint=? WHERE id=?",
                (fp, log_id),
            )
        c.commit()

    # ------------------------------------------------------------------ #
    # read operations
    # ------------------------------------------------------------------ #
    def list_latest_scans(self, limit: int = 20) -> list:
        rows = self.conn.execute(
            "SELECT DISTINCT scan_id, created_at FROM tasks ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_validations(self, scan_id: str) -> list:
        rows = self.conn.execute(
            """SELECT v.*, t.cron_expression, t.command, t.user, t.script_path
               FROM validations v
               LEFT JOIN tasks t
                 ON v.scan_id = t.scan_id
                AND v.task_fingerprint = t.fingerprint
               WHERE v.scan_id = ?
               ORDER BY v.id""",
            (scan_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_task_stats(self, scan_id: str) -> list:
        rows = self.conn.execute(
            "SELECT * FROM task_stats WHERE scan_id=? ORDER BY id", (scan_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_execution_logs(
        self, scan_id: str, fingerprint: Optional[str] = None
    ) -> list:
        if fingerprint:
            rows = self.conn.execute(
                """SELECT * FROM execution_logs
                   WHERE scan_id=? AND matched_fingerprint=?
                   ORDER BY timestamp""",
                (scan_id, fingerprint),
            ).fetchall()
        else:
            rows = self.conn.execute(
                """SELECT * FROM execution_logs
                   WHERE scan_id=? ORDER BY timestamp""",
                (scan_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_report(self, scan_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM reports WHERE scan_id=? ORDER BY id DESC LIMIT 1",
            (scan_id,),
        ).fetchone()
        return dict(row) if row else None

    def get_latest_report(self) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM reports ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None

    def get_latest_scan_id(self) -> Optional[str]:
        row = self.conn.execute(
            "SELECT scan_id FROM tasks ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        return row["scan_id"] if row else None

    def get_task_history(self, fingerprint: str, limit: int = 10) -> list:
        """Return recent stats rows for a task fingerprint across scans."""
        rows = self.conn.execute(
            """SELECT s.*, v.status, v.issues
               FROM task_stats s
               LEFT JOIN validations v
                 ON s.scan_id = v.scan_id
                AND s.fingerprint = v.task_fingerprint
               WHERE s.fingerprint=?
               ORDER BY s.created_at DESC
               LIMIT ?""",
            (fingerprint, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------ #
    # internal helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _opt_bool(value: Optional[bool]) -> Optional[int]:
        if value is None:
            return None
        return int(value)
