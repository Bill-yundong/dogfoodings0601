"""一致性映射表: 保证同一原始值脱敏后结果相同。

使用 SQLite 持久化映射表, 即使跨多张表/多次处理, 同一字段类型下的同一原始值
始终映射到同一个脱敏结果。映射表存储于独立的一致性库文件, 不污染目标脱敏库。
"""
from __future__ import annotations

import os
import sqlite3
from typing import Callable, Optional


class ConsistencyMap:
    def __init__(self, db_path: str = "consistency_map.db"):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def open(self) -> "ConsistencyMap":
        self._conn = sqlite3.connect(self.db_path)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS mask_mapping ("
            "  field_type TEXT NOT NULL,"
            "  original   TEXT NOT NULL,"
            "  masked     TEXT NOT NULL,"
            "  PRIMARY KEY (field_type, original)"
            ")"
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mapping_ft ON mask_mapping(field_type)"
        )
        self._conn.commit()
        return self

    def get_or_create(
        self,
        field_type: str,
        original: str,
        mask_func: Callable[[str], str],
    ) -> str:
        if self._conn is None:
            raise RuntimeError("ConsistencyMap 未 open")

        row = self._conn.execute(
            "SELECT masked FROM mask_mapping WHERE field_type=? AND original=?",
            (field_type, original),
        ).fetchone()
        if row is not None:
            return row[0]

        masked = mask_func(original)
        self._conn.execute(
            "INSERT OR IGNORE INTO mask_mapping (field_type, original, masked) "
            "VALUES (?, ?, ?)",
            (field_type, original, masked),
        )
        self._conn.commit()
        return masked

    def count(self) -> int:
        if self._conn is None:
            return 0
        row = self._conn.execute("SELECT COUNT(*) FROM mask_mapping").fetchone()
        return int(row[0]) if row else 0

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> "ConsistencyMap":
        return self.open()

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def drop(self) -> None:
        self.close()
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
