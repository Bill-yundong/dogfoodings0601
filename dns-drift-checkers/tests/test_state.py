"""测试 state 模块: _calc_consecutive 规则 + update() first_seen 保留。"""

import json
from datetime import datetime, timedelta

import pytest

from state import StateManager


def _state_path(tmp_path):
    return str(tmp_path / "state.json")


def _dt(date_str, time_str="10:00:00"):
    return datetime.fromisoformat(f"{date_str}T{time_str}")


class TestCalcConsecutive:
    def test_old_ts_none_returns_1(self):
        result = StateManager._calc_consecutive(
            None,
            _dt("2026-06-22"),
            {"consecutive_days": 100},
        )
        assert result == 1

    def test_same_day_does_not_increase(self):
        old_ts = _dt("2026-06-22", "09:00:00")
        new_ts = _dt("2026-06-22", "15:30:00")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 3}
        )
        assert result == 3

    def test_same_day_exact_midnight_boundary(self):
        old_ts = _dt("2026-06-22", "00:00:01")
        new_ts = _dt("2026-06-22", "23:59:59")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 7}
        )
        assert result == 7

    def test_next_day_increments_by_1(self):
        old_ts = _dt("2026-06-22", "23:59:59")
        new_ts = _dt("2026-06-23", "00:00:01")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 5}
        )
        assert result == 6

    def test_next_day_from_1_becomes_2(self):
        old_ts = _dt("2026-06-22", "12:00:00")
        new_ts = _dt("2026-06-23", "12:00:00")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 1}
        )
        assert result == 2

    def test_two_days_gap_resets_to_1(self):
        old_ts = _dt("2026-06-22")
        new_ts = _dt("2026-06-24")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 10}
        )
        assert result == 1

    def test_long_gap_resets_to_1(self):
        old_ts = _dt("2026-01-01")
        new_ts = _dt("2026-06-22")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 99}
        )
        assert result == 1

    def test_backwards_in_time_preserves_count(self):
        old_ts = _dt("2026-06-23", "12:00:00")
        new_ts = _dt("2026-06-22", "12:00:00")
        result = StateManager._calc_consecutive(
            old_ts, new_ts, {"consecutive_days": 4}
        )
        assert result == 4


class TestStateManagerInit:
    def test_new_state_file_is_empty(self, tmp_path):
        sm = StateManager(_state_path(tmp_path))
        assert sm.state["last_scan"] is None
        assert sm.state["drifts"] == {}

    def test_nonexistent_path_no_error(self, tmp_path):
        sm = StateManager(str(tmp_path / "no_such.json"))
        assert sm.state == {"last_scan": None, "drifts": {}}

    def test_corrupt_json_defaults_to_empty(self, tmp_path):
        path = _state_path(tmp_path)
        with open(path, "w") as f:
            f.write("not valid json {{{")
        sm = StateManager(path)
        assert sm.state == {"last_scan": None, "drifts": {}}

    def test_valid_state_file_loaded(self, tmp_path):
        path = _state_path(tmp_path)
        data = {
            "last_scan": "2026-06-20T12:00:00",
            "drifts": {
                "key1": {"first_seen": "2026-06-20T12:00:00", "consecutive_days": 2}
            },
        }
        with open(path, "w") as f:
            json.dump(data, f)
        sm = StateManager(path)
        assert sm.last_scan == "2026-06-20T12:00:00"
        assert "key1" in sm.state["drifts"]


class TestStateUpdateFirstSeen:
    def test_new_drift_gets_first_seen_set(self, tmp_path):
        path = _state_path(tmp_path)
        sm = StateManager(path)
        scan_time = _dt("2026-06-22", "10:00:00")
        drifts = {
            "ex.com": [
                {
                    "drift_type": "tampered",
                    "record_type": "A",
                    "expected": "1.1.1.1",
                    "actual": ["2.2.2.2"],
                    "detail": None,
                }
            ]
        }
        sm.update(drifts, scan_time)
        entry = list(sm.state["drifts"].values())[0]
        assert entry["first_seen"] == scan_time.isoformat()
        assert entry["last_seen"] == scan_time.isoformat()
        assert entry["consecutive_days"] == 1

    def test_existing_drift_preserves_first_seen_across_scans(self, tmp_path):
        path = _state_path(tmp_path)
        sm = StateManager(path)
        drift_obj = {
            "drift_type": "tampered",
            "record_type": "A",
            "expected": "1.1.1.1",
            "actual": ["2.2.2.2"],
            "detail": None,
        }
        scan1 = _dt("2026-06-22", "10:00:00")
        sm.update({"ex.com": [drift_obj]}, scan1)
        first_seen_1 = list(sm.state["drifts"].values())[0]["first_seen"]

        drift_obj_changed_actual = {
            "drift_type": "tampered",
            "record_type": "A",
            "expected": "1.1.1.1",
            "actual": ["9.9.9.9", "8.8.8.8"],
            "detail": None,
        }
        scan2 = _dt("2026-06-23", "10:00:00")
        sm.update({"ex.com": [drift_obj_changed_actual]}, scan2)

        entry = list(sm.state["drifts"].values())[0]
        assert entry["first_seen"] == first_seen_1
        assert entry["last_seen"] == scan2.isoformat()
        assert entry["consecutive_days"] == 2

    def test_actual_value_rotation_does_not_create_new_key(self, tmp_path):
        path = _state_path(tmp_path)
        sm = StateManager(path)
        scan1 = _dt("2026-06-22")
        drift_ips1 = {
            "drift_type": "tampered",
            "record_type": "A",
            "expected": "93.184.216.34",
            "actual": ["104.20.23.154", "172.66.147.243"],
        }
        sm.update({"ex.com": [drift_ips1]}, scan1)

        scan2 = _dt("2026-06-22", "15:00:00")
        drift_ips2 = {
            "drift_type": "tampered",
            "record_type": "A",
            "expected": "93.184.216.34",
            "actual": ["10.0.0.1", "10.0.0.2"],
        }
        sm.update({"ex.com": [drift_ips2]}, scan2)

        assert len(sm.state["drifts"]) == 1
        entry = list(sm.state["drifts"].values())[0]
        assert entry["consecutive_days"] == 1
        assert entry["first_seen"] == scan1.isoformat()
        assert entry["actual"] == ["10.0.0.1", "10.0.0.2"]

    def test_resolved_drift_removed_from_state(self, tmp_path):
        path = _state_path(tmp_path)
        sm = StateManager(path)
        scan1 = _dt("2026-06-22")
        sm.update(
            {
                "a.com": [
                    {
                        "drift_type": "missing",
                        "record_type": "A",
                        "expected": "1.1.1.1",
                        "actual": None,
                    }
                ],
                "b.com": [
                    {
                        "drift_type": "added",
                        "record_type": "MX",
                        "expected": None,
                        "actual": "10 mail.com",
                    }
                ],
            },
            scan1,
        )
        assert len(sm.state["drifts"]) == 2

        scan2 = _dt("2026-06-23")
        sm.update(
            {
                "b.com": [
                    {
                        "drift_type": "added",
                        "record_type": "MX",
                        "expected": None,
                        "actual": "10 mail.com",
                    }
                ]
            },
            scan2,
        )
        assert len(sm.state["drifts"]) == 1
        only_key = list(sm.state["drifts"].keys())[0]
        assert "MX" in only_key

    def test_missing_drift_preserves_first_seen(self, tmp_path):
        path = _state_path(tmp_path)
        sm = StateManager(path)
        scan1 = _dt("2026-06-22", "09:00:00")
        missing = {
            "drift_type": "missing",
            "record_type": "A",
            "expected": "1.2.3.4",
            "actual": None,
        }
        sm.update({"ex.com": [missing]}, scan1)

        scan2 = _dt("2026-06-23", "09:00:00")
        missing2 = dict(missing)
        missing2["actual"] = None
        sm.update({"ex.com": [missing2]}, scan2)

        entry = list(sm.state["drifts"].values())[0]
        assert entry["first_seen"] == scan1.isoformat()
        assert entry["consecutive_days"] == 2


class TestStateSaveAndReload:
    def test_save_and_reload_preserves_state(self, tmp_path):
        path = _state_path(tmp_path)
        sm1 = StateManager(path)
        scan_time = _dt("2026-06-22", "14:30:00")
        sm1.update(
            {
                "ex.com": [
                    {
                        "drift_type": "tampered",
                        "record_type": "A",
                        "expected": "1.1.1.1",
                        "actual": ["2.2.2.2"],
                    }
                ]
            },
            scan_time,
        )
        sm1.save()

        sm2 = StateManager(path)
        assert sm2.last_scan == scan_time.isoformat()
        assert len(sm2.state["drifts"]) == 1
        entry = list(sm2.state["drifts"].values())[0]
        assert entry["first_seen"] == scan_time.isoformat()
        assert entry["consecutive_days"] == 1

    def test_update_cross_day_increments(self, tmp_path):
        path = _state_path(tmp_path)
        sm = StateManager(path)
        days_drift = {
            "drift_type": "tampered",
            "record_type": "A",
            "expected": "1.1.1.1",
            "actual": ["9.9.9.9"],
        }
        scan_times = [
            _dt("2026-06-20", "10:00:00"),
            _dt("2026-06-21", "10:00:00"),
            _dt("2026-06-22", "10:00:00"),
        ]
        for i, t in enumerate(scan_times):
            sm.update({"d.com": [days_drift]}, t)
            assert list(sm.state["drifts"].values())[0]["consecutive_days"] == i + 1
