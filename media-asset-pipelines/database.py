import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime


SCHEMA = """
CREATE TABLE IF NOT EXISTS asset_manifest (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    content_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    last_modified REAL NOT NULL,
    thumbnail_path TEXT,
    medium_path TEXT,
    large_path TEXT,
    processed_at REAL,
    status TEXT DEFAULT 'pending',
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_hash ON asset_manifest(content_hash);
CREATE INDEX IF NOT EXISTS idx_status ON asset_manifest(status);
"""


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._get_conn() as conn:
            conn.executescript(SCHEMA)

    def get_record_by_path(self, file_path: str):
        abs_path = os.path.abspath(file_path)
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM asset_manifest WHERE file_path = ?",
                (abs_path,)
            ).fetchone()
            return dict(row) if row else None

    def get_record_by_hash(self, content_hash: str):
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM asset_manifest WHERE content_hash = ?",
                (content_hash,)
            ).fetchone()
            return dict(row) if row else None

    def upsert_asset(self, file_path: str, content_hash: str,
                     file_size: int, last_modified: float):
        abs_path = os.path.abspath(file_path)
        with self._get_conn() as conn:
            existing = conn.execute(
                """SELECT content_hash, file_size, last_modified
                   FROM asset_manifest WHERE file_path = ?""",
                (abs_path,)
            ).fetchone()
            if existing:
                changed = (existing['content_hash'] != content_hash or
                           existing['file_size'] != file_size or
                           abs(existing['last_modified'] - last_modified) >= 0.001)
                if changed:
                    conn.execute(
                        """UPDATE asset_manifest
                           SET content_hash = ?, file_size = ?, last_modified = ?,
                               status = 'pending', thumbnail_path = NULL,
                               medium_path = NULL, large_path = NULL,
                               processed_at = NULL, error_message = NULL
                           WHERE file_path = ?""",
                        (content_hash, file_size, last_modified, abs_path)
                    )
            else:
                conn.execute(
                    """INSERT INTO asset_manifest
                       (file_path, content_hash, file_size, last_modified, status)
                       VALUES (?, ?, ?, ?, 'pending')""",
                    (abs_path, content_hash, file_size, last_modified)
                )

    def mark_processed(self, file_path: str, variants: dict):
        abs_path = os.path.abspath(file_path)
        with self._get_conn() as conn:
            conn.execute(
                """UPDATE asset_manifest
                   SET thumbnail_path = ?, medium_path = ?, large_path = ?,
                       processed_at = ?, status = 'processed', error_message = NULL
                   WHERE file_path = ?""",
                (
                    variants.get('thumbnail'),
                    variants.get('medium'),
                    variants.get('large'),
                    datetime.now().timestamp(),
                    abs_path
                )
            )

    def mark_failed(self, file_path: str, error_message: str):
        abs_path = os.path.abspath(file_path)
        with self._get_conn() as conn:
            conn.execute(
                """UPDATE asset_manifest
                   SET status = 'failed', error_message = ?, processed_at = ?
                   WHERE file_path = ?""",
                (error_message, datetime.now().timestamp(), abs_path)
            )

    def is_up_to_date(self, file_path: str, content_hash: str,
                      file_size: int, last_modified: float) -> bool:
        abs_path = os.path.abspath(file_path)
        with self._get_conn() as conn:
            row = conn.execute(
                """SELECT content_hash, file_size, last_modified, status
                   FROM asset_manifest WHERE file_path = ?""",
                (abs_path,)
            ).fetchone()
            if not row:
                return False
            if row['status'] != 'processed':
                return False
            return (row['content_hash'] == content_hash and
                    row['file_size'] == file_size and
                    abs(row['last_modified'] - last_modified) < 0.001)

    def get_stats(self):
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT status, COUNT(*) as cnt FROM asset_manifest GROUP BY status"
            ).fetchall()
            return {row['status']: row['cnt'] for row in rows}
