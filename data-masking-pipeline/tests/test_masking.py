"""MaskingEngine 单元测试:
  1. keep_ends 处理正常长度值
  2. keep_ends 处理短于 keep_prefix + keep_suffix 的值
  3. keep_ends 处理单字符/空字符串/None 值
  4. mask_middle 中间掩码 (身份证掩码生日)
  5. mask_email 处理正常邮箱
  6. mask_email 处理本地只有 1 个字符的邮箱
  7. mask_email 处理不含 @ 的输入
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import FieldRule, MaskingStrategy, Rules, DetectionConfig
from consistency import ConsistencyMap
from masking import MaskingEngine


def make_rules() -> Rules:
    rules = Rules()
    rules.column_rules["phone"] = FieldRule(
        field_type="phone",
        keywords=["phone"],
        patterns=[r"1[3-9]\d{9}"],
    )
    rules.column_rules["idcard"] = FieldRule(
        field_type="idcard",
        keywords=["idcard"],
        patterns=[],
    )
    rules.column_rules["email"] = FieldRule(
        field_type="email",
        keywords=["email"],
        patterns=[],
    )
    rules.masking["phone"] = MaskingStrategy(
        strategy="keep_ends", keep_prefix=3, keep_suffix=4, mask_char="*"
    )
    rules.masking["idcard"] = MaskingStrategy(
        strategy="mask_middle", mask_length=8, start=6, mask_char="*"
    )
    rules.masking["email"] = MaskingStrategy(
        strategy="mask_email", keep_local_prefix=1, mask_char="*"
    )
    rules.detection = DetectionConfig()
    return rules


class TestKeepEnds(unittest.TestCase):
    def setUp(self):
        self.rules = make_rules()
        self._cmap_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "_test_cmap_masking.db"
        )
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        if os.path.exists(self._cmap_file):
            os.remove(self._cmap_file)

    def _engine(self):
        cmap = ConsistencyMap(self._cmap_file).open()
        return MaskingEngine(self.rules, cmap), cmap

    def test_normal_phone_11_digits(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("phone", "13812345678")
            self.assertEqual(result, "138****5678")
        finally:
            cmap.close()

    def test_value_shorter_than_keep_prefix_plus_suffix(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("phone", "12345")
            self.assertEqual(len(result), 5)
            self.assertEqual(result[:4], "1234")
            self.assertEqual(result[4], "*")
        finally:
            cmap.close()

    def test_value_length_equals_prefix_plus_suffix(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("phone", "1234567")
            self.assertEqual(len(result), 7)
            self.assertEqual(result[:6], "123456")
            self.assertEqual(result[6], "*")
        finally:
            cmap.close()

    def test_empty_string_unchanged(self):
        engine, cmap = self._engine()
        try:
            self.assertEqual(engine.mask_value("phone", ""), "")
            self.assertIsNone(engine.mask_value("phone", None))
        finally:
            cmap.close()

    def test_single_char(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("phone", "1")
            self.assertEqual(len(result), 1)
            self.assertEqual(result, "*")
        finally:
            cmap.close()


class TestMaskMiddle(unittest.TestCase):
    def setUp(self):
        self.rules = make_rules()
        self._cmap_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "_test_cmap_mid.db"
        )
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        if os.path.exists(self._cmap_file):
            os.remove(self._cmap_file)

    def _engine(self):
        cmap = ConsistencyMap(self._cmap_file).open()
        return MaskingEngine(self.rules, cmap), cmap

    def test_idcard_masks_birthday_exactly(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("idcard", "330106199207129160")
            self.assertEqual(result, "330106********9160")
        finally:
            cmap.close()

    def test_short_string_all_masked(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("idcard", "abcd")
            self.assertEqual(result, "****")
        finally:
            cmap.close()


class TestMaskEmail(unittest.TestCase):
    def setUp(self):
        self.rules = make_rules()
        self._cmap_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "_test_cmap_email.db"
        )
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        if os.path.exists(self._cmap_file):
            os.remove(self._cmap_file)

    def _engine(self):
        cmap = ConsistencyMap(self._cmap_file).open()
        return MaskingEngine(self.rules, cmap), cmap

    def test_normal_email(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("email", "user123@gmail.com")
            self.assertEqual(result, "u***@gmail.com")
        finally:
            cmap.close()

    def test_local_single_char(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("email", "a@qq.com")
            self.assertEqual(result, "***@qq.com")
        finally:
            cmap.close()

    def test_no_at_sign_unchanged(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("email", "just-a-string")
            self.assertEqual(result, "just-a-string")
        finally:
            cmap.close()

    def test_empty_local_part(self):
        engine, cmap = self._engine()
        try:
            result = engine.mask_value("email", "@example.com")
            self.assertEqual(result, "***@example.com")
        finally:
            cmap.close()


if __name__ == "__main__":
    unittest.main()
