"""ConsistencyMap 单元测试:
  1. 同一原始值在同一 field_type 下两次 get_or_create 得到相同结果
  2. 不同原始值得到不同结果
  3. 同一原始值在不同 field_type 下互不影响
  4. 跨会话 (重新打开同一 db) 仍保持一致性
  5. None 映射和空字符串等边界
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from consistency import ConsistencyMap


def mask_phone(s: str) -> str:
    if len(s) < 7:
        return "*" * len(s)
    return s[:3] + "*" * (len(s) - 7) + s[-4:]


def mask_email(s: str) -> str:
    if "@" not in s:
        return s
    local, _, domain = s.partition("@")
    return (local[0] if local else "") + "***@" + domain


class TestConsistencyMap(unittest.TestCase):
    def setUp(self):
        self.db = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "_test_cmap.db"
        )
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        if os.path.exists(self.db):
            os.remove(self.db)

    def test_same_original_same_result(self):
        with ConsistencyMap(self.db) as cmap:
            a = cmap.get_or_create("phone", "13812345678", mask_phone)
            b = cmap.get_or_create("phone", "13812345678", mask_phone)
            self.assertEqual(a, b)
            self.assertEqual(a, "138****5678")

    def test_same_original_1000_times_same_result(self):
        with ConsistencyMap(self.db) as cmap:
            first = cmap.get_or_create("phone", "13900001111", mask_phone)
            for _ in range(999):
                result = cmap.get_or_create("phone", "13900001111", mask_phone)
                self.assertEqual(result, first)

    def test_different_originals_get_different_results(self):
        with ConsistencyMap(self.db) as cmap:
            a = cmap.get_or_create("phone", "13812345678", mask_phone)
            b = cmap.get_or_create("phone", "13987654321", mask_phone)
            self.assertNotEqual(a, b)

    def test_same_original_different_field_types_independent(self):
        with ConsistencyMap(self.db) as cmap:
            phone_r = cmap.get_or_create("phone", "13812345678", mask_phone)
            email_r = cmap.get_or_create(
                "email", "13812345678", lambda x: "***@example.com"
            )
            self.assertNotEqual(phone_r, email_r)
            self.assertEqual(phone_r, "138****5678")
            self.assertEqual(email_r, "***@example.com")

    def test_persistence_across_sessions(self):
        with ConsistencyMap(self.db) as cmap:
            first = cmap.get_or_create("phone", "13811112222", mask_phone)
            self.assertEqual(cmap.count(), 1)

        with ConsistencyMap(self.db) as cmap:
            second = cmap.get_or_create("phone", "13811112222", mask_phone)
            self.assertEqual(first, second)
            self.assertEqual(cmap.count(), 1)

    def test_empty_string(self):
        with ConsistencyMap(self.db) as cmap:
            r1 = cmap.get_or_create("phone", "", lambda s: "EMPTY")
            r2 = cmap.get_or_create("phone", "", lambda s: "EMPTY")
            self.assertEqual(r1, r2)

    def test_count_grows_with_unique_values(self):
        with ConsistencyMap(self.db) as cmap:
            self.assertEqual(cmap.count(), 0)
            for i in range(5):
                cmap.get_or_create("phone", "138%08d" % i, mask_phone)
            self.assertEqual(cmap.count(), 5)
            cmap.get_or_create("phone", "13800000000", mask_phone)
            self.assertEqual(cmap.count(), 5)

    def test_context_manager_protocol(self):
        cmap = ConsistencyMap(self.db)
        with cmap as opened:
            self.assertIs(opened, cmap)
            opened.get_or_create("phone", "13800000000", mask_phone)
        with self.assertRaises(RuntimeError):
            cmap.get_or_create("phone", "13800000000", mask_phone)


if __name__ == "__main__":
    unittest.main()
