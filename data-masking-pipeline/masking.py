"""脱敏引擎: 按字段类型选择脱敏策略, 并将脱敏后数据写入目标库。

策略:
  phone    -> 保留前3后4              (138****5678)
  idcard   -> 掩码中间8位(出生日期)    (110101********1234)
  bankcard -> 保留前4后4              (6222****5678)
  email    -> 保留域名, 本地部分掩码    (t***@gmail.com)

同一原始值经 ConsistencyMap 始终得到相同脱敏结果。
"""
from __future__ import annotations

import os
import sqlite3
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List

from config import Rules
from consistency import ConsistencyMap
from scanner import ScanResult


@dataclass
class MaskingStats:
    tables_processed: int = 0
    rows_processed: int = 0
    columns_masked: int = 0
    values_masked_by_type: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    values_masked_total: int = 0
    consistency_entries: int = 0

    def as_dict(self) -> dict:
        return {
            "tables_processed": self.tables_processed,
            "rows_processed": self.rows_processed,
            "columns_masked": self.columns_masked,
            "values_masked_by_type": dict(self.values_masked_by_type),
            "values_masked_total": self.values_masked_total,
            "consistency_entries": self.consistency_entries,
        }


class MaskingEngine:
    def __init__(self, rules: Rules, consistency: ConsistencyMap):
        self.rules = rules
        self.consistency = consistency
        self.stats = MaskingStats()

    def mask_value(self, field_type: str, value) -> str:
        if value is None:
            return None
        s = str(value).strip()
        if not s:
            return s

        strategy = self.rules.masking.get(field_type)
        if strategy is None:
            return s

        masked = self.consistency.get_or_create(
            field_type, s, lambda v: self._apply_strategy(strategy, v)
        )
        if masked != s:
            self.stats.values_masked_by_type[field_type] += 1
            self.stats.values_masked_total += 1
        return masked

    def _apply_strategy(self, strategy, value: str) -> str:
        name = strategy.strategy
        if name == "keep_ends":
            return self._keep_ends(strategy, value)
        if name == "mask_middle":
            return self._mask_middle(strategy, value)
        if name == "mask_email":
            return self._mask_email(strategy, value)
        return value

    @staticmethod
    def _keep_ends(strategy, value: str) -> str:
        n = len(value)
        prefix = strategy.keep_prefix
        suffix = strategy.keep_suffix
        if prefix + suffix >= n:
            keep = max(n - 1, 0)
            masked_len = max(n - keep, 0)
            return value[:keep] + strategy.mask_char * masked_len
        masked_len = n - prefix - suffix
        return value[:prefix] + strategy.mask_char * masked_len + value[n - suffix:]

    @staticmethod
    def _mask_middle(strategy, value: str) -> str:
        n = len(value)
        ml = strategy.mask_length
        if n <= ml:
            return strategy.mask_char * n
        if strategy.start is not None:
            start = min(strategy.start, n - ml)
            start = max(start, 0)
        else:
            start = (n - ml) // 2
        return value[:start] + (strategy.mask_char * ml) + value[start + ml:]

    @staticmethod
    def _mask_email(strategy, value: str) -> str:
        if "@" not in value:
            return value
        local, _, domain = value.partition("@")
        keep = strategy.keep_local_prefix
        if len(local) <= keep:
            masked_local = strategy.mask_char * max(len(local), 3)
        else:
            masked_local = local[:keep] + strategy.mask_char * 3
        return f"{masked_local}@{domain}"

    def run(self, source_path: str, target_path: str, scan: ScanResult) -> MaskingStats:
        if os.path.exists(target_path):
            os.remove(target_path)

        src = sqlite3.connect(source_path)
        tgt = sqlite3.connect(target_path)
        try:
            self._copy_schema(src, tgt)

            sensitive = scan.by_table()
            all_tables = [
                r[0] for r in src.execute(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                ).fetchall()
            ]
            for table in all_tables:
                self._process_table(src, tgt, table, sensitive.get(table, []))

            tgt.commit()
        finally:
            src.close()
            tgt.close()

        self.stats.consistency_entries = self.consistency.count()
        return self.stats

    def _copy_schema(self, src: sqlite3.Connection, tgt: sqlite3.Connection) -> None:
        rows = src.execute(
            "SELECT sql, name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"
        ).fetchall()
        for sql, _name in rows:
            tgt.execute(sql)
        idx_rows = src.execute(
            "SELECT sql FROM sqlite_master "
            "WHERE type IN ('index','view','trigger') AND sql IS NOT NULL "
            "AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        for (sql,) in idx_rows:
            tgt.execute(sql)
        tgt.commit()

    def _process_table(self, src, tgt, table, fields) -> None:
        col_to_type = {f.column: f.field_type for f in fields}
        columns = [r[1] for r in src.execute(f'PRAGMA table_info("{table}")').fetchall()]
        self.stats.columns_masked += len(col_to_type)

        col_list = ", ".join(f'"{c}"' for c in columns)
        placeholders = ", ".join("?" for _ in columns)
        insert_sql = f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'

        select_sql = f'SELECT {col_list} FROM "{table}"'
        cursor = src.execute(select_sql)
        batch: List[tuple] = []
        batch_size = 500

        while True:
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break
            for row in rows:
                row_list = list(row)
                for idx, col in enumerate(columns):
                    if col in col_to_type:
                        masked = self.mask_value(col_to_type[col], row_list[idx])
                        row_list[idx] = masked
                batch.append(tuple(row_list))
            tgt.executemany(insert_sql, batch)
            batch.clear()

        count_row = src.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()
        self.stats.tables_processed += 1
        self.stats.rows_processed += int(count_row[0]) if count_row else 0
