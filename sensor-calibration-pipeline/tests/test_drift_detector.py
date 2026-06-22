import pytest

from src.drift_detector import DriftDetector


def _make_row(ts, sensor_id, calibrated_value):
    return {
        "timestamp": ts,
        "sensor_id": sensor_id,
        "raw_value": calibrated_value,
        "calibrated_value": calibrated_value,
    }


class TestDriftDetector:
    def test_no_alert_when_below_threshold(self):
        detector = DriftDetector(window_size=3, consecutive_alerts=2)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.1}
        data = [_make_row(f"t{i}", "TEMP-001", 100.0) for i in range(5)]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 0

    def test_alert_triggers_only_after_consecutive_threshold(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=3)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.05}
        data = [
            _make_row("t1", "TEMP-001", 106.0),
            _make_row("t2", "TEMP-001", 106.0),
            _make_row("t3", "TEMP-001", 106.0),
        ]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 1

    def test_alert_not_triggered_below_consecutive(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=3)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.05}
        data = [
            _make_row("t1", "TEMP-001", 106.0),
            _make_row("t2", "TEMP-001", 106.0),
        ]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 0

    def test_no_alert_spam_same_drift_episode(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=2)
        baseline = {"VIB-004": 100.0}
        tolerance = {"VIB-004": 0.05}
        data = [_make_row(f"t{i}", "VIB-004", 110.0) for i in range(20)]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 1

    def test_alert_state_resets_after_returning_to_normal(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=2)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.05}
        data = (
            [_make_row(f"drift{i}", "TEMP-001", 110.0) for i in range(3)]
            + [_make_row(f"norm{i}", "TEMP-001", 100.0) for i in range(3)]
            + [_make_row(f"drift2_{i}", "TEMP-001", 110.0) for i in range(3)]
        )
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 2

    def test_baseline_zero_uses_absolute_deviation(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"ZERO-SENSOR": 0.0}
        tolerance = {"ZERO-SENSOR": 0.05}
        data = [
            _make_row("t1", "ZERO-SENSOR", 0.0),
            _make_row("t2", "ZERO-SENSOR", 0.1),
        ]
        analyzed, alerts = detector.detect(data, baseline, tolerance)
        assert analyzed[0]["relative_deviation"] == 0.0
        assert analyzed[1]["relative_deviation"] == 1.0
        assert len(alerts) == 1

    def test_baseline_zero_nonzero_value_treated_as_deviation(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"ZERO-SENSOR": 0.0}
        tolerance = {"ZERO-SENSOR": 0.9}
        data = [_make_row("t1", "ZERO-SENSOR", 0.5)]
        analyzed, alerts = detector.detect(data, baseline, tolerance)
        assert analyzed[0]["relative_deviation"] == 1.0
        assert len(alerts) == 1

    def test_warning_severity_below_double_tolerance(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.1}
        data = [_make_row("t1", "TEMP-001", 114.0)]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "warning"
        assert alerts[0]["relative_deviation"] == pytest.approx(0.14)

    def test_critical_severity_at_or_above_double_tolerance(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.1}
        data = [_make_row("t1", "TEMP-001", 120.0)]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "critical"

    def test_warning_critical_boundary_exactly_double(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.1}
        data = [_make_row("t1", "TEMP-001", 120.0)]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert alerts[0]["relative_deviation"] == pytest.approx(0.20)
        assert alerts[0]["severity"] == "critical"

    def test_warning_critical_boundary_below_double(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.1}
        data = [_make_row("t1", "TEMP-001", 119.9)]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert alerts[0]["relative_deviation"] == pytest.approx(0.199)
        assert alerts[0]["severity"] == "warning"

    def test_multiple_sensors_independent_alert_state(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"SENS-A": 100.0, "SENS-B": 50.0}
        tolerance = {"SENS-A": 0.05, "SENS-B": 0.05}
        data = [
            _make_row("t1", "SENS-A", 106.0),
            _make_row("t1", "SENS-B", 50.0),
            _make_row("t2", "SENS-A", 106.0),
            _make_row("t2", "SENS-B", 50.0),
        ]
        _, alerts = detector.detect(data, baseline, tolerance)
        assert len(alerts) == 1
        assert alerts[0]["sensor_id"] == "SENS-A"

    def test_analyzed_data_contains_all_fields(self):
        detector = DriftDetector(window_size=1, consecutive_alerts=1)
        baseline = {"TEMP-001": 100.0}
        tolerance = {"TEMP-001": 0.1}
        data = [_make_row("t1", "TEMP-001", 105.0)]
        analyzed, _ = detector.detect(data, baseline, tolerance)
        row = analyzed[0]
        assert "baseline_value" in row
        assert "window_mean" in row
        assert "absolute_deviation" in row
        assert "relative_deviation" in row
        assert "tolerance" in row
        assert "is_out_of_tolerance" in row
        assert "is_suspected_aging" in row
        assert "alert_severity" in row

    def test_sliding_window_mean_is_correct(self):
        detector = DriftDetector(window_size=3, consecutive_alerts=1)
        baseline = {"TEMP-001": 0.0}
        tolerance = {"TEMP-001": 0.1}
        data = [
            _make_row("t1", "TEMP-001", 10.0),
            _make_row("t2", "TEMP-001", 20.0),
            _make_row("t3", "TEMP-001", 30.0),
        ]
        analyzed, _ = detector.detect(data, baseline, tolerance)
        assert analyzed[0]["window_mean"] == pytest.approx(10.0)
        assert analyzed[1]["window_mean"] == pytest.approx(15.0)
        assert analyzed[2]["window_mean"] == pytest.approx(20.0)
