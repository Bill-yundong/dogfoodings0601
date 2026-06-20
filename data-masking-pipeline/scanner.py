"""扫描器: 连接 SQLite 源库, 用双重策略自动标记疑似敏感字段。

双重策略:
  1. 列名语义匹配 —— 列名命中关键字直接判定 (优先)
  2. 正则模式匹配 —— 对列内样本值用正则模式库匹配, 命中率达阈值则判定
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from config import Rules


@dataclass
class SensitiveField:
    table: str
    column: str
    field_type: str
    reason: str  # "column_name" | "regex_pattern"
    match_ratio: float = 1.0


@dataclass
class ScanResult:
    fields: List[SensitiveField] = field(default_factory=list)
    tables_scanned: int = 0
    columns_scanned: int = 0

    def by_table(self) -> Dict[str, List[SensitiveField]]:
        grouped: Dict[str, List[SensitiveField]] = {}
        for f in self.fields:
            grouped.setdefault(f.table, []).append(f)
        return grouped

    def columns_for(self, table: str) -> Dict[str, str]:
        return {f.column: f.field_type for f in self.fields if f.table == table}


class Scanner:
    def __init__(self, db_path: str, rules: Rules):
        self.db_path = db_path
        self.rules = rules

    def scan(self) -> ScanResult:
        result = ScanResult()
        conn = sqlite3.connect(self.db_path)
        try:
            tables = self._list_tables(conn)
            result.tables_scanned = len(tables)
            for table in tables:
                columns = self._list_columns(conn, table)
                result.columns_scanned += len(columns)
                for column in columns:
                    field_type = self._detect(conn, table, column)
                    if field_type:
                        sf = SensitiveField(
                            table=table,
                            column=column,
                            field_type=field_type[0],
                            reason=field_type[1],
                            match_ratio=field_type[2],
                        )
                        result.fields.append(sf)
        finally:
            conn.close()
        return result

    @staticmethod
    def _list_tables(conn: sqlite3.Connection) -> List[str]:
        rows = conn.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' "
            "ORDER BY name"
        ).fetchall()
        return [r[0] for r in rows]

    @staticmethod
    def _list_columns(conn: sqlite3.Connection, table: str) -> List[str]:
        rows = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        return [r[1] for r in rows]

    def _detect(self, conn: sqlite3.Connection, table: str, column: str):
        # 策略一: 列名语义匹配 (优先)
        col_lower = column.lower()
        for field_type, rule in self.rules.column_rules.items():
            for kw in rule.keywords:
                if kw.lower() in col_lower:
                    return (field_type, "column_name", 1.0)

        # 策略二: 正则模式匹配
        sample_size = self.rules.detection.sample_size
        rows = conn.execute(
            f'SELECT "{column}" FROM "{table}" '
            f'WHERE "{column}" IS NOT NULL LIMIT ?',
            (sample_size,),
        ).fetchall()
        values = [str(r[0]).strip() for r in rows if r[0] is not None and str(r[0]).strip()]
        if not values:
            return None

        threshold = self.rules.detection.match_threshold
        best = None
        for field_type, rule in self.rules.column_rules.items():
            compiled = [re.compile(p) for p in rule.patterns]
            matched = sum(
                1 for v in values if any(c.fullmatch(v) for c in compiled)
            )
            ratio = matched / len(values)
            if ratio >= threshold and (best is None or ratio > best[2]):
                best = (field_type, "regex_pattern", ratio)
        return best
