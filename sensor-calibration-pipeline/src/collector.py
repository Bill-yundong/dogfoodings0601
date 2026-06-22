"""Data collector module for reading raw sensor CSV data."""

from typing import Dict, List

from .utils import read_csv, setup_logger

logger = setup_logger(__name__)


class DataCollector:
    """Collects and parses raw sensor data from CSV files."""

    REQUIRED_COLUMNS = {"timestamp", "sensor_id", "raw_value"}

    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.raw_data: List[Dict] = []

    def load(self) -> List[Dict]:
        logger.info(f"Loading raw sensor data from {self.csv_path}")
        data = read_csv(self.csv_path)
        self._validate_columns(data)
        self.raw_data = self._parse_numeric(data)
        logger.info(f"Loaded {len(self.raw_data)} sensor records")
        return self.raw_data

    def _validate_columns(self, data: List[Dict]) -> None:
        if not data:
            raise ValueError("CSV file is empty")
        columns = set(data[0].keys())
        missing = self.REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError(
                f"Missing required columns: {missing}. Found: {columns}"
            )

    def _parse_numeric(self, data: List[Dict]) -> List[Dict]:
        parsed = []
        for row in data:
            try:
                parsed_row = {
                    "timestamp": row["timestamp"],
                    "sensor_id": row["sensor_id"],
                    "raw_value": float(row["raw_value"]),
                }
                for key, value in row.items():
                    if key not in parsed_row:
                        parsed_row[key] = value
                parsed.append(parsed_row)
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid row {row}: {e}")
        return parsed

    def get_sensor_ids(self) -> List[str]:
        if not self.raw_data:
            self.load()
        return sorted({row["sensor_id"] for row in self.raw_data})

    def get_data_by_sensor(self, sensor_id: str) -> List[Dict]:
        if not self.raw_data:
            self.load()
        return [row for row in self.raw_data if row["sensor_id"] == sensor_id]
