"""Drift detection module using sliding window offset analysis."""

from collections import deque
from typing import Deque, Dict, List, Tuple

from .utils import setup_logger

logger = setup_logger(__name__)


class DriftDetector:
    """Detects sensor drift using sliding window comparison with baseline values."""

    def __init__(
        self,
        window_size: int = 10,
        drift_threshold: float = 0.1,
        consecutive_alerts: int = 3,
    ):
        self.window_size = window_size
        self.drift_threshold = drift_threshold
        self.consecutive_alerts = consecutive_alerts
        self.sliding_windows: Dict[str, Deque[float]] = {}
        self.consecutive_count: Dict[str, int] = {}
        self.alerts: List[Dict] = []

    def _init_sensor_state(self, sensor_id: str) -> None:
        if sensor_id not in self.sliding_windows:
            self.sliding_windows[sensor_id] = deque(maxlen=self.window_size)
            self.consecutive_count[sensor_id] = 0

    def _calculate_window_mean(self, sensor_id: str) -> float:
        window = self.sliding_windows[sensor_id]
        if not window:
            return 0.0
        return sum(window) / len(window)

    def _calculate_deviation(
        self, calibrated_value: float, baseline: float
    ) -> Tuple[float, float]:
        if baseline == 0:
            absolute_deviation = abs(calibrated_value)
            relative_deviation = 1.0 if absolute_deviation > 0 else 0.0
        else:
            absolute_deviation = abs(calibrated_value - baseline)
            relative_deviation = absolute_deviation / abs(baseline)
        return absolute_deviation, relative_deviation

    def detect(
        self,
        calibrated_data: List[Dict],
        baseline_values: Dict[str, float],
        tolerances: Dict[str, float],
    ) -> Tuple[List[Dict], List[Dict]]:
        logger.info(
            f"Starting drift detection on {len(calibrated_data)} records with window size={self.window_size}"
        )
        self.alerts = []
        analyzed_data = []

        for row in calibrated_data:
            sensor_id = row["sensor_id"]
            calibrated_value = row["calibrated_value"]
            baseline = baseline_values.get(sensor_id, 0.0)
            tolerance = tolerances.get(sensor_id, self.drift_threshold)

            self._init_sensor_state(sensor_id)
            self.sliding_windows[sensor_id].append(calibrated_value)

            window_mean = self._calculate_window_mean(sensor_id)
            abs_dev, rel_dev = self._calculate_deviation(window_mean, baseline)

            is_out_of_tolerance = rel_dev > tolerance
            is_suspected_aging = False
            alert_severity = "normal"

            if is_out_of_tolerance:
                self.consecutive_count[sensor_id] += 1
                if self.consecutive_count[sensor_id] >= self.consecutive_alerts:
                    is_suspected_aging = True
                    alert_severity = "warning" if rel_dev < tolerance * 2 else "critical"
                    self._record_alert(
                        row,
                        baseline,
                        window_mean,
                        abs_dev,
                        rel_dev,
                        tolerance,
                        alert_severity,
                    )
            else:
                self.consecutive_count[sensor_id] = 0

            analyzed_row = dict(row)
            analyzed_row.update(
                {
                    "baseline_value": baseline,
                    "window_mean": round(window_mean, 6),
                    "absolute_deviation": round(abs_dev, 6),
                    "relative_deviation": round(rel_dev, 6),
                    "tolerance": tolerance,
                    "is_out_of_tolerance": is_out_of_tolerance,
                    "is_suspected_aging": is_suspected_aging,
                    "alert_severity": alert_severity,
                }
            )
            analyzed_data.append(analyzed_row)

        logger.info(
            f"Drift detection completed. Found {len(self.alerts)} suspected aging alerts"
        )
        return analyzed_data, self.alerts

    def _record_alert(
        self,
        row: Dict,
        baseline: float,
        window_mean: float,
        abs_dev: float,
        rel_dev: float,
        tolerance: float,
        severity: str,
    ) -> None:
        alert = {
            "timestamp": row["timestamp"],
            "sensor_id": row["sensor_id"],
            "alert_type": "suspected_sensor_aging",
            "severity": severity,
            "baseline_value": baseline,
            "window_mean": round(window_mean, 6),
            "absolute_deviation": round(abs_dev, 6),
            "relative_deviation": round(rel_dev, 6),
            "tolerance": tolerance,
            "exceedance_ratio": round(rel_dev / tolerance, 2),
            "message": f"Sensor {row['sensor_id']} shows suspected aging: "
            f"deviation {round(rel_dev * 100, 1)}% exceeds tolerance {round(tolerance * 100, 1)}%",
        }
        self.alerts.append(alert)
        logger.warning(alert["message"])

    def get_alerts(self) -> List[Dict]:
        return self.alerts
