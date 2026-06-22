import json

import pytest

from src.calibrator import CalibrationEngine


def _write_calibration_json(tmp_path, config):
    json_file = tmp_path / "cal.json"
    json_file.write_text(json.dumps(config, indent=2))
    return str(json_file)


class TestCalibrationEngine:
    def test_polynomial_linear_coefficients(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "coefficients": [1.0, 2.0],
                    "baseline": 51.0,
                    "tolerance": 0.05,
                }
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        result = engine.apply_polynomial(25.0, [1.0, 2.0])
        assert result == pytest.approx(51.0)

    def test_polynomial_quadratic_coefficients(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "coefficients": [1.2, 0.985, 0.0012],
                    "baseline": 26.575,
                    "tolerance": 0.05,
                }
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        result = engine.apply_polynomial(25.0, [1.2, 0.985, 0.0012])
        assert result == pytest.approx(26.575)

    def test_polynomial_calibrates_all_records(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "coefficients": [0.0, 1.0],
                    "baseline": 25.0,
                    "tolerance": 0.05,
                }
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        raw_data = [
            {"timestamp": "t1", "sensor_id": "TEMP-001", "raw_value": 10.0},
            {"timestamp": "t2", "sensor_id": "TEMP-001", "raw_value": 20.0},
        ]
        calibrated = engine.calibrate(raw_data)
        assert calibrated[0]["calibrated_value"] == pytest.approx(10.0)
        assert calibrated[1]["calibrated_value"] == pytest.approx(20.0)

    def test_unconfigured_sensor_uses_raw_value(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "coefficients": [0.0, 2.0],
                    "baseline": 50.0,
                    "tolerance": 0.05,
                }
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        raw_data = [
            {"timestamp": "t1", "sensor_id": "UNKNOWN-999", "raw_value": 42.0},
        ]
        calibrated = engine.calibrate(raw_data)
        assert calibrated[0]["calibrated_value"] == pytest.approx(42.0)

    def test_default_window_size_read_from_json(self, tmp_path):
        config = {
            "default_window_size": 20,
            "default_consecutive_alerts": 5,
            "sensors": {
                "TEMP-001": {
                    "coefficients": [1.0, 1.0],
                    "baseline": 25.0,
                    "tolerance": 0.05,
                }
            },
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        assert engine.default_window_size == 20
        assert engine.default_consecutive_alerts == 5

    def test_default_window_size_falls_back_when_missing(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "coefficients": [1.0, 1.0],
                    "baseline": 25.0,
                    "tolerance": 0.05,
                }
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        assert engine.default_window_size == CalibrationEngine.DEFAULT_WINDOW_SIZE
        assert engine.default_consecutive_alerts == CalibrationEngine.DEFAULT_CONSECUTIVE_ALERTS

    def test_missing_sensors_key_raises(self, tmp_path):
        config = {"some_other_key": {}}
        path = _write_calibration_json(tmp_path, config)
        with pytest.raises(ValueError, match="missing 'sensors' key"):
            CalibrationEngine(path)

    def test_sensor_missing_coefficients_raises(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "baseline": 25.0,
                }
            }
        }
        path = _write_calibration_json(tmp_path, config)
        with pytest.raises(ValueError, match="missing 'coefficients'"):
            CalibrationEngine(path)

    def test_baseline_and_tolerance_loaded(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {
                    "coefficients": [1.0, 1.0],
                    "baseline": 26.5,
                    "tolerance": 0.03,
                },
                "PRESS-002": {
                    "coefficients": [0.5, 1.0],
                    "baseline": 99.9,
                    "tolerance": 0.02,
                },
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        assert engine.get_baseline("TEMP-001") == pytest.approx(26.5)
        assert engine.get_tolerance("TEMP-001") == pytest.approx(0.03)
        assert engine.get_baseline("PRESS-002") == pytest.approx(99.9)
        assert engine.get_tolerance("PRESS-002") == pytest.approx(0.02)

    def test_get_baseline_unknown_sensor_defaults_zero(self, tmp_path):
        config = {
            "sensors": {
                "TEMP-001": {"coefficients": [1.0], "baseline": 25.0, "tolerance": 0.05}
            }
        }
        path = _write_calibration_json(tmp_path, config)
        engine = CalibrationEngine(path)
        assert engine.get_baseline("UNKNOWN") == 0.0
        assert engine.get_tolerance("UNKNOWN") == 0.05
