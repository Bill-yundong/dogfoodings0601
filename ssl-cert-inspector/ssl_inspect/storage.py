"""SQLite persistence for historical inspection records.

Each run writes one row per inspected domain. Stored history enables trend
tracing -- e.g. watching remaining days decrease run over run, or seeing a
domain flip from ``warning`` to ``critical`` to ``expired``.
"""

from __future__ import annotations

import os
import sqlite3
from typing import Dict, List, Optional


SCHEMA = """
CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    port INTEGER NOT NULL,
    status TEXT NOT NULL,
    level TEXT NOT NULL,
    issuer TEXT,
    subject TEXT,
    not_before TEXT,
    not_after TEXT,
    remaining_days INTEGER,
    error TEXT,
    inspected_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspections_domain_time
    ON inspections(domain, inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_level_time
    ON inspections(level, inspected_at DESC);
"""


class InspectionStore:
    """Thin wrapper around a SQLite database file."""

    def __init__(self, path: str) -> None:
        self.path = path
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def save(self, result: Dict) -> int:
        """Insert a single inspection result, returning the new row id."""
        server = result.get("server_certificate") or {}
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO inspections
                    (domain, port, status, level, issuer, subject,
                     not_before, not_after, remaining_days, error, inspected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result["domain"],
                    result["port"],
                    result["status"],
                    result["level"],
                    server.get("issuer"),
                    server.get("subject"),
                    server.get("not_before"),
                    server.get("not_after"),
                    result.get("remaining_days"),
                    result.get("error"),
                    result.get("inspected_at"),
                ),
            )
            conn.commit()
            return int(cur.lastrowid)

    def save_many(self, results: List[Dict]) -> int:
        """Insert many results in a single transaction."""
        rows = []
        for result in results:
            server = result.get("server_certificate") or {}
            rows.append(
                (
                    result["domain"],
                    result["port"],
                    result["status"],
                    result["level"],
                    server.get("issuer"),
                    server.get("subject"),
                    server.get("not_before"),
                    server.get("not_after"),
                    result.get("remaining_days"),
                    result.get("error"),
                    result.get("inspected_at"),
                )
            )
        with self._connect() as conn:
            conn.executemany(
                """
                INSERT INTO inspections
                    (domain, port, status, level, issuer, subject,
                     not_before, not_after, remaining_days, error, inspected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()
        return len(rows)

    def history(self, domain: str, limit: int = 20) -> List[Dict]:
        """Return the most recent ``limit`` records for a domain."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT domain, port, status, level, issuer, subject,
                       not_before, not_after, remaining_days, error, inspected_at
                FROM inspections
                WHERE domain = ?
                ORDER BY inspected_at DESC
                LIMIT ?
                """,
                (domain, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def latest_per_domain(self) -> List[Dict]:
        """Return the single most recent record per domain (one row each)."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT i.domain, i.port, i.status, i.level, i.issuer, i.subject,
                       i.not_before, i.not_after, i.remaining_days, i.error,
                       i.inspected_at
                FROM inspections i
                INNER JOIN (
                    SELECT domain, MAX(inspected_at) AS max_ts
                    FROM inspections
                    GROUP BY domain
                ) m ON i.domain = m.domain AND i.inspected_at = m.max_ts
                ORDER BY i.domain
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def count(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM inspections").fetchone()
        return int(row["c"])
