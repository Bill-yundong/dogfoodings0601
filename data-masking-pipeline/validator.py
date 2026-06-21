"""校验模块: 对比脱敏前后数据, 确保没有漏脱或误脱。

校验维度:
  1. 行数一致性 —— 脱敏前后每张表行数必须相等
  2. 非敏感字段一致性 —— 非敏感列的值必须完全一致
  3. 敏感字段已脱敏检查 —— 敏感列不应再出现原始值(抽样正则命中即告警)
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field
from typing import Dict, List

from config import Rules
from scanner import ScanResult


@dataclass
class TableValidation:
    table: str
    source_rows: int = 0
    target_rows: int = 0
    row_count_match: bool = False
    non_sensitive_mismatches: int = 0
    sensitive_leaks: int = 0
    passed: bool = False
    notes: List[str] = field(default_factory=list)


@dataclass
class ValidationReport:
    tables: List[TableValidation] = field(default_factory=list)
    passed: bool = False

    @property
    def total_mismatches(self) -> int:
        return sum(t.non_sensitive_mismatches for t in self.tables)

    @property
    def total_leaks(self) -> int:
        return sum(t.sensitive_leaks for t in self.tables)


class Validator:
    def __init__(self, source_path: str, target_path: str, rules: Rules):
        self.source_path = source_path
        self.target_path = target_path
        self.rules = rules

    def validate(self, scan: ScanResult) -> ValidationReport:
        report = ValidationReport()
        src = sqlite3.connect(self.source_path)
        tgt = sqlite3.connect(self.target_path)
        try:
            sensitive = scan.by_table()
            tables = [r[0] for r in src.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()]

            all_passed = True
            for table in tables:
                tv = self._validate_table(src, tgt, table, sensitive.get(table, []))
                report.tables.append(tv)
                if not tv.passed:
                    all_passed = False
            report.passed = all_passed
        finally:
            src.close()
            tgt.close()
        return report

    def _validate_table(self, src, tgt, table, sensitive_fields) -> TableValidation:
        tv = TableValidation(table=table)

        src_count = src.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        tgt_count = tgt.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        tv.source_rows = int(src_count)
        tv.target_rows = int(tgt_count)
        tv.row_count_match = (tv.source_rows == tv.target_rows)
        if not tv.row_count_match:
            tv.notes.append(
                f"行数不一致: 源={tv.source_rows}, 目标={tv.target_rows}"
            )

        columns = [r[1] for r in src.execute(f'PRAGMA table_info("{table}")').fetchall()]
        sensitive_cols = {f.column for f in sensitive_fields}
        non_sensitive_cols = [c for c in columns if c not in sensitive_cols]

        tv.non_sensitive_mismatches = self._compare_non_sensitive(
            src, tgt, table, non_sensitive_cols
        )
        if tv.non_sensitive_mismatches:
            tv.notes.append(
                f"非敏感字段不一致行数: {tv.non_sensitive_mismatches}"
            )

        tv.sensitive_leaks = self._check_sensitive_leaks(
            tgt, table, sensitive_fields
        )
        if tv.sensitive_leaks:
            tv.notes.append(
                f"疑似未脱敏敏感值: {tv.sensitive_leaks} 个"
            )

        tv.passed = (
            tv.row_count_match
            and tv.non_sensitive_mismatches == 0
            and tv.sensitive_leaks == 0
        )
        return tv

    @staticmethod
    def _compare_non_sensitive(src, tgt, table, cols) -> int:
        if not cols:
            return 0
        col_list = ", ".join(f'"{c}"' for c in cols)
        src_cur = src.execute(f'SELECT {col_list} FROM "{table}" ORDER BY rowid')
        tgt_cur = tgt.execute(f'SELECT {col_list} FROM "{table}" ORDER BY rowid')
        mismatches = 0
        while True:
            s = src_cur.fetchmany(500)
            t = tgt_cur.fetchmany(500)
            if not s and not t:
                break
            max_len = max(len(s), len(t))
            for i in range(max_len):
                a = s[i] if i < len(s) else None
                b = t[i] if i < len(t) else None
                if a != b:
                    mismatches += 1
        return mismatches

    def _check_sensitive_leaks(self, tgt, table, sensitive_fields) -> int:
        if not sensitive_fields:
            return 0
        leaks = 0
        for sf in sensitive_fields:
            rule = self.rules.column_rules.get(sf.field_type)
            if not rule or not rule.patterns:
                continue
            compiled = [re.compile(p) for p in rule.patterns]
            sample_size = self.rules.detection.sample_size
            rows = tgt.execute(
                f'SELECT "{sf.column}" FROM "{table}" '
                f'WHERE "{sf.column}" IS NOT NULL LIMIT ?',
                (sample_size,),
            ).fetchall()
            for (val,) in rows:
                s = str(val).strip()
                if not s:
                    continue
                if any(c.fullmatch(s) for c in compiled):
                    leaks += 1
        return leaks
