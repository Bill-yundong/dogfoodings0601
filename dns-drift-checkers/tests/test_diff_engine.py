"""测试 diff_engine 模块: compare() 分类 + drift_key() 稳定性。"""

import pytest

from diff_engine import (
    DiffEngine,
    DRIFT_ADDED,
    DRIFT_MISSING,
    DRIFT_TAMPERED,
    drift_key,
)


def _actual(records=None, error=None):
    return {"error": error, "records": list(records) if records else []}


def _drifts_by_type(drifts, dtype):
    return [d for d in drifts if d["drift_type"] == dtype]


class TestCompareNoDrift:
    def test_empty_expected_empty_actual(self):
        assert DiffEngine.compare({}, {}) == []

    def test_matching_single_a_record(self):
        expected = {"A": ["1.2.3.4"]}
        actual = {"A": _actual(["1.2.3.4"])}
        assert DiffEngine.compare(expected, actual) == []

    def test_matching_multiple_mx_records_order_independent(self):
        expected = {"MX": ["10 a.com", "20 b.com"]}
        actual = {"MX": _actual(["20 b.com", "10 a.com"])}
        assert DiffEngine.compare(expected, actual) == []


class TestCompareAdded:
    def test_single_added_a(self):
        expected = {"A": ["1.1.1.1"]}
        actual = {"A": _actual(["1.1.1.1", "2.2.2.2"])}
        drifts = DiffEngine.compare(expected, actual)
        added = _drifts_by_type(drifts, DRIFT_ADDED)
        assert len(added) == 1
        assert added[0]["record_type"] == "A"
        assert added[0]["expected"] is None
        assert added[0]["actual"] == "2.2.2.2"
        assert _drifts_by_type(drifts, DRIFT_MISSING) == []
        assert _drifts_by_type(drifts, DRIFT_TAMPERED) == []

    def test_multiple_added_sorted(self):
        expected = {"A": ["1.1.1.1"]}
        actual = {"A": _actual(["1.1.1.1", "3.3.3.3", "2.2.2.2"])}
        drifts = DiffEngine.compare(expected, actual)
        added = _drifts_by_type(drifts, DRIFT_ADDED)
        assert len(added) == 2
        assert added[0]["actual"] == "2.2.2.2"
        assert added[1]["actual"] == "3.3.3.3"

    def test_all_added_no_expected(self):
        expected = {"A": []}
        actual = {"A": _actual(["1.1.1.1", "2.2.2.2"])}
        drifts = DiffEngine.compare(expected, actual)
        added = _drifts_by_type(drifts, DRIFT_ADDED)
        assert len(added) == 2


class TestCompareMissing:
    def test_single_missing_a(self):
        expected = {"A": ["1.1.1.1", "2.2.2.2"]}
        actual = {"A": _actual(["2.2.2.2"])}
        drifts = DiffEngine.compare(expected, actual)
        missing = _drifts_by_type(drifts, DRIFT_MISSING)
        assert len(missing) == 1
        assert missing[0]["record_type"] == "A"
        assert missing[0]["expected"] == "1.1.1.1"
        assert missing[0]["actual"] is None

    def test_all_missing(self):
        expected = {"A": ["1.1.1.1", "2.2.2.2"]}
        actual = {"A": _actual([])}
        drifts = DiffEngine.compare(expected, actual)
        missing = _drifts_by_type(drifts, DRIFT_MISSING)
        assert len(missing) == 2

    def test_resolver_error_marks_all_expected_missing(self):
        expected = {"A": ["1.1.1.1", "2.2.2.2"]}
        actual = {"A": _actual(None, error="timeout")}
        drifts = DiffEngine.compare(expected, actual)
        missing = _drifts_by_type(drifts, DRIFT_MISSING)
        assert len(missing) == 2
        assert all("resolver error: timeout" in (m["detail"] or "") for m in missing)


class TestCompareTampered:
    def test_single_expected_replaced(self):
        expected = {"A": ["1.1.1.1"]}
        actual = {"A": _actual(["9.9.9.9"])}
        drifts = DiffEngine.compare(expected, actual)
        tampered = _drifts_by_type(drifts, DRIFT_TAMPERED)
        assert len(tampered) == 1
        assert tampered[0]["record_type"] == "A"
        assert tampered[0]["expected"] == "1.1.1.1"
        assert tampered[0]["actual"] == ["9.9.9.9"]

    def test_multiple_expected_replaced_with_multiple_actual(self):
        expected = {"A": ["1.1.1.1", "2.2.2.2"]}
        actual = {"A": _actual(["9.9.9.9", "8.8.8.8"])}
        drifts = DiffEngine.compare(expected, actual)
        tampered = _drifts_by_type(drifts, DRIFT_TAMPERED)
        assert len(tampered) == 2
        assert tampered[0]["expected"] == "1.1.1.1"
        assert tampered[1]["expected"] == "2.2.2.2"
        assert tampered[0]["actual"] == ["8.8.8.8", "9.9.9.9"]
        assert tampered[1]["actual"] == ["8.8.8.8", "9.9.9.9"]

    def test_partial_match_rest_tampered(self):
        expected = {"A": ["1.1.1.1", "2.2.2.2"]}
        actual = {"A": _actual(["2.2.2.2", "9.9.9.9"])}
        drifts = DiffEngine.compare(expected, actual)
        tampered = _drifts_by_type(drifts, DRIFT_TAMPERED)
        assert len(tampered) == 1
        assert tampered[0]["expected"] == "1.1.1.1"
        assert tampered[0]["actual"] == ["9.9.9.9"]
        assert _drifts_by_type(drifts, DRIFT_ADDED) == []
        assert _drifts_by_type(drifts, DRIFT_MISSING) == []


class TestCompareMixedTypes:
    def test_a_mx_separate_classification(self):
        expected = {
            "A": ["1.1.1.1"],
            "MX": ["10 mail.com"],
        }
        actual = {
            "A": _actual(["9.9.9.9"]),
            "MX": _actual(["10 mail.com", "20 backup.com"]),
        }
        drifts = DiffEngine.compare(expected, actual)
        assert len(drifts) == 2
        tampered = _drifts_by_type(drifts, DRIFT_TAMPERED)
        added = _drifts_by_type(drifts, DRIFT_ADDED)
        assert len(tampered) == 1 and tampered[0]["record_type"] == "A"
        assert len(added) == 1 and added[0]["record_type"] == "MX"


class TestDriftKey:
    def test_tampered_key_does_not_contain_actual_value(self):
        drift_a = {
            "drift_type": DRIFT_TAMPERED,
            "record_type": "A",
            "expected": "93.184.216.34",
            "actual": ["104.20.23.154", "172.66.147.243"],
        }
        drift_b = {
            "drift_type": DRIFT_TAMPERED,
            "record_type": "A",
            "expected": "93.184.216.34",
            "actual": ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
        }
        key_a = drift_key("example.com", drift_a)
        key_b = drift_key("example.com", drift_b)
        assert key_a == key_b
        assert "104.20.23.154" not in key_a
        assert "172.66.147.243" not in key_a

    def test_tampered_key_structure(self):
        drift = {
            "drift_type": DRIFT_TAMPERED,
            "record_type": "MX",
            "expected": "10 smtp.gmail.com",
            "actual": ["10 smtp.google.com"],
        }
        key = drift_key("google.com", drift)
        parts = key.split("|")
        assert len(parts) == 4
        assert parts[0] == "google.com"
        assert parts[1] == "MX"
        assert parts[2] == DRIFT_TAMPERED
        assert parts[3] == "10 smtp.gmail.com"

    def test_missing_key_excludes_actual(self):
        drift_a = {
            "drift_type": DRIFT_MISSING,
            "record_type": "A",
            "expected": "1.2.3.4",
            "actual": None,
        }
        drift_b = {
            "drift_type": DRIFT_MISSING,
            "record_type": "A",
            "expected": "1.2.3.4",
            "actual": ["placeholder"],
        }
        assert drift_key("x.com", drift_a) == drift_key("x.com", drift_b)

    def test_added_key_includes_actual(self):
        drift_a = {
            "drift_type": DRIFT_ADDED,
            "record_type": "A",
            "expected": None,
            "actual": "9.9.9.9",
        }
        drift_b = {
            "drift_type": DRIFT_ADDED,
            "record_type": "A",
            "expected": None,
            "actual": "8.8.8.8",
        }
        assert drift_key("x.com", drift_a) != drift_key("x.com", drift_b)
        assert "9.9.9.9" in drift_key("x.com", drift_a)
