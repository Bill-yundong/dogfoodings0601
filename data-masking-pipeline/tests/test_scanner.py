"""Scanner 单元测试:
  1. 列名关键字检测路径 (列名命中 keywords 直接判定
  2. 正则采样检测路径 (列名无关键字, 靠值正则匹配
  3. 命中率卡 0.5 阈值边界 (刚好 50% 命中通过, 49.9% 不通过)
"""
from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import FieldRule, MaskingStrategy, Rules, DetectionConfig
from scanner import Scanner


def make_rules(threshold=0.5, sample_size=100) -> Rules:
    rules = Rules()
    rules.column_rules["phone"] = FieldRule(
        field_type="phone",
        keywords=["phone", "mobile", "手机号"],
        patterns=[r"1[3-9]\d{9}"],
    )
    rules.column_rules["email"] = FieldRule(
        field_type="email",
        keywords=["email", "邮箱"],
        patterns=[r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"],
    )
    rules.masking["phone"] = MaskingStrategy(strategy="keep_ends", keep_prefix=3, keep_suffix=4, mask_char="*")
    rules.masking["email"] = MaskingStrategy(strategy="mask_email", keep_local_prefix=1, mask_char="*")
    rules.detection = DetectionConfig(sample_size=sample_size, match_threshold=threshold)
    return rules


class ScannerTestBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.db_path = self.tmp.name
        self.conn = sqlite3.connect(self.db_path)

    def tearDown(self):
        self.conn.close()
        os.unlink(self.db_path)

    def mk_table(self, name, columns, rows=None):
        cols_sql = ", ".join(f'"{c}" TEXT' for c in columns)
        self.conn.execute(f"CREATE TABLE {name} ({cols_sql})")
        if rows:
            ph = ", ".join(["?"] * len(columns))
            self.conn.executemany(f"INSERT INTO {name} VALUES ({ph})", rows)
        self.conn.commit()


class TestColumnNameDetection(ScannerTestBase):
    def test_column_name_keyword_phone(self):
        self.mk_table(
            "t1",
            ["id", "phone_num", "remark"],
            rows=[
                (1, "13800000000", "hello"),
                (2, "not-a-phone", "world"),
            ],
        )
        rules = make_rules()
        scan = Scanner(self.db_path, rules).scan()

        phones = [f for f in scan.fields if f.field_type == "phone"]
        self.assertEqual(len(phones), 1)
        self.assertEqual(phones[0].column, "phone_num")
        self.assertEqual(phones[0].reason, "column_name")
        self.assertEqual(phones[0].match_ratio, 1.0)

    def test_column_name_keyword_takes_priority_over_regex(self):
        self.mk_table(
            "t2",
            ["id", "手机号"],
            rows=[
                (1, "13800000000"),
                (2, "13911112222"),
            ],
        )
        rules = make_rules()
        scan = Scanner(self.db_path, rules).scan()

        phone_fields = [f for f in scan.fields if f.field_type == "phone"]
        self.assertEqual(len(phone_fields), 1)
        self.assertEqual(phone_fields[0].reason, "column_name")

    def test_no_sensitive_columns(self):
        self.mk_table(
            "clean",
            ["id", "name", "age"],
            rows=[(1, "a", 20), (2, "b", 30)],
        )
        rules = make_rules()
        scan = Scanner(self.db_path, rules).scan()
        self.assertEqual(len(scan.fields), 0)
        self.assertEqual(scan.tables_scanned, 1)


class TestRegexDetection(ScannerTestBase):
    def test_regex_detects_phone_values(self):
        rows = [(i, "138%08d" % i) for i in range(1, 21)]
        self.mk_table(
            "t3",
            ["id", "contact"],
            rows=rows,
        )
        rules = make_rules()
        scan = Scanner(self.db_path, rules).scan()

        contact = [f for f in scan.fields if f.column == "contact"]
        self.assertEqual(len(contact), 1)
        self.assertEqual(contact[0].field_type, "phone")
        self.assertEqual(contact[0].reason, "regex_pattern")

    def test_regex_best_match_ratio(self):
        self.mk_table(
            "t4",
            ["id", "mixed"],
            rows=[
                (1, "13800000000"),
                (2, "abc"),
                (3, "13900000001"),
                (4, "xyz"),
                (5, "13700000002"),
                (6, "foo"),
            ],
        )
        rules = make_rules(threshold=0.5)
        scan = Scanner(self.db_path, rules).scan()
        mixed = [f for f in scan.fields if f.column == "mixed"]
        self.assertEqual(len(mixed), 1)
        self.assertEqual(mixed[0].field_type, "phone")
        self.assertAlmostEqual(mixed[0].match_ratio, 0.5)


class TestThresholdBoundary(ScannerTestBase):
    def test_exactly_50_percent_passes(self):
        rows = []
        for i in range(10):
            if i % 2 == 0:
                rows.append((i, "138%08d" % i))
            else:
                rows.append((i, "no-phone"))
        self.mk_table("t_boundary", ["id", "col"], rows=rows)

        rules = make_rules(threshold=0.5, sample_size=10)
        scan = Scanner(self.db_path, rules).scan()
        fields = [f for f in scan.fields if f.column == "col"]
        self.assertEqual(len(fields), 1)
        self.assertAlmostEqual(fields[0].match_ratio, 0.5)

    def test_below_threshold_rejected(self):
        rows = []
        for i in range(20):
            if i % 10 == 0:
                rows.append((i, "138%08d" % i))
            else:
                rows.append((i, "plain"))
        self.mk_table("t_below", ["id", "col"], rows=rows)
        rules = make_rules(threshold=0.5, sample_size=20)
        scan = Scanner(self.db_path, rules).scan()
        fields = [f for f in scan.fields if f.column == "col"]
        self.assertEqual(len(fields), 0)

    def test_sample_size_limits_scan(self):
        rows = []
        for i in range(200):
            rows.append((i, "138%08d" % i))
        self.mk_table("t_sample", ["id", "big_col"], rows=rows)
        rules = make_rules(threshold=0.5, sample_size=10)
        scan = Scanner(self.db_path, rules).scan()
        big_cols = [f for f in scan.fields if f.column == "big_col"]
        self.assertEqual(len(big_cols), 1)
        self.assertAlmostEqual(big_cols[0].match_ratio, 1.0)
        self.assertEqual(scan.tables_scanned, 1)


if __name__ == "__main__":
    unittest.main()
