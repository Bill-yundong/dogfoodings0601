"""Quarantine store: the isolation queue for rows that could not be cleaned.

Instead of crashing the whole run when a CSV row fails to parse or violates a
business rule, the cleaner hands the offending row to this store.  Each
record keeps:

* ``source_file``  - the file it came from
* ``source_line``  - the 1-based *physical* line number where the logical row
                     began in that file (so an operator can ``sed -n`` it)
* ``stage``        - which pipeline stage rejected it (``clean``/``transform``)
* ``reason``       - a short, machine-greppable failure reason
* ``raw_content``  - the verbatim text of the offending row
* ``encoding``     - the encoding that was detected for the file

The store is backed by a SQLite table (``_quarantine_rows``) inside the same
target database, which means quarantined data is queryable right next to the
clean data it was rejected from.
"""

from __future__ import annotations

import datetime
import os
import sqlite3
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

QUARANTINE_TABLE = "_quarantine_rows"


@dataclass
class QuarantineRecord:
    source_file: str
    source_line: int
    stage: str
    reason: str
    raw_content: str
    encoding: Optional[str] = None


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


class QuarantineStore:
    """Thin wrapper around the ``_quarantine_rows`` SQLite table."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def init(self) -> None:
        self.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {QUARANTINE_TABLE} (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file  TEXT,
                source_line  INTEGER,
                stage        TEXT,
                reason       TEXT,
                raw_content  TEXT,
                encoding     TEXT,
                ingested_at  TEXT
            )
            """
        )
        self.conn.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{QUARANTINE_TABLE}_file "
            f"ON {QUARANTINE_TABLE}(source_file)"
        )
        self.conn.commit()

    def put(self, record: QuarantineRecord) -> None:
        self.conn.execute(
            f"""
            INSERT INTO {QUARANTINE_TABLE}
                (source_file, source_line, stage, reason, raw_content, encoding, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.source_file,
                record.source_line,
                record.stage,
                record.reason,
                record.raw_content,
                record.encoding,
                _now(),
            ),
        )

    def put_many(self, records: Iterable[QuarantineRecord]) -> int:
        rows = [
            (
                r.source_file,
                r.source_line,
                r.stage,
                r.reason,
                r.raw_content,
                r.encoding,
                _now(),
            )
            for r in records
        ]
        if not rows:
            return 0
        self.conn.executemany(
            f"""
            INSERT INTO {QUARANTINE_TABLE}
                (source_file, source_line, stage, reason, raw_content, encoding, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        return len(rows)

    def count(self) -> int:
        cur = self.conn.execute(f"SELECT COUNT(*) FROM {QUARANTINE_TABLE}")
        return cur.fetchone()[0]

    def breakdown_by_reason(self) -> Dict[str, int]:
        cur = self.conn.execute(
            f"SELECT reason, COUNT(*) FROM {QUARANTINE_TABLE} GROUP BY reason ORDER BY 2 DESC"
        )
        return {reason: cnt for reason, cnt in cur.fetchall()}

    def sample(self, limit: int = 10) -> List[sqlite3.Row]:
        cur = self.conn.execute(
            f"""
            SELECT source_file, source_line, stage, reason, raw_content, encoding
            FROM {QUARANTINE_TABLE}
            ORDER BY id
            LIMIT ?
            """,
            (limit,),
        )
        return cur.fetchall()

    @staticmethod
    def basename(path: str) -> str:
        return os.path.basename(path) if path else path
