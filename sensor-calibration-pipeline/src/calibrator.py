"""Calibration engine module for polynomial value range transformation."""

from typing import Dict, List

from .utils import load_json, setup_logger

logger = setup_logger(__name__)


class CalibrationEngine:
    """Applies polynomial calibration coefficients to sensor readings."""

    def __init__(self, calibration_config_path: str):
        self.config_path = calibration_config_path
        self.config: Dict = {}
        self.sensor_coefficients: Dict[str, List[float]] = {}
        self.baseline_values: Dict[str, float] = {}
        self.tolerance: Dict[str, float] = {}
        self._load_config()

    def _load_config(self) -> None:
        logger.info(f"Loading calibration config from {self.config_path}")
        self.config = load_json(self.config_path)

        if "sensors" not in self.config:
            raise ValueError("Invalid calibration config: missing 'sensors' key")

        for sensor_id, sensor_config in self.config["sensors"].items():
            if "coefficients" not in sensor_config:
                raise ValueError(
                    f"Sensor {sensor_id} missing 'coefficients' in config"
                )
            self.sensor_coefficients[sensor_id] = [
                float(c) for c in sensor_config["coefficients"]
            ]
            self.baseline_values[sensor_id] = float(
                sensor_config.get("baseline", 0.0)
            )
            self.tolerance[sensor_id] = float(
                sensor_config.get("tolerance", 0.05)
            )

        logger.info(
            f"Loaded calibration config for {len(self.sensor_coefficients)} sensors"
        )

    def apply_polynomial(self, raw_value: float, coefficients: List[float]) -> float:
        result = 0.0
        for i, coeff in enumerate(coefficients):
            result += coeff * (raw_value ** i)
        return result

    def calibrate(self, raw_data: List[Dict]) -> List[Dict]:
        logger.info(f"Calibrating {len(raw_data)} sensor records")
        calibrated_data = []

        for row in raw_data:
            sensor_id = row["sensor_id"]
            raw_value = row["raw_value"]

            if sensor_id not in self.sensor_coefficients:
                logger.warning(
                    f"No calibration config for sensor {sensor_id}, using raw value"
                )
                calibrated_value = raw_value
            else:
                coefficients = self.sensor_coefficients[sensor_id]
                calibrated_value = self.apply_polynomial(raw_value, coefficients)

            calibrated_row = dict(row)
            calibrated_row["calibrated_value"] = round(calibrated_value, 6)
            calibrated_data.append(calibrated_row)

        logger.info("Calibration completed")
        return calibrated_data

    def get_sensor_ids(self) -> List[str]:
        return sorted(self.sensor_coefficients.keys())

    def get_baseline(self, sensor_id: str) -> float:
        return self.baseline_values.get(sensor_id, 0.0)

    def get_tolerance(self, sensor_id: str) -> float:
        return self.tolerance.get(sensor_id, 0.05)
