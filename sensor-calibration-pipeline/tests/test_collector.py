import pytest

from src.collector import DataCollector


class TestDataCollector:
    def test_csv_missing_required_column_raises_error(self, tmp_path):
        csv_file = tmp_path / "bad.csv"
        csv_file.write_text(
            "timestamp,sensor_id\n"
            "2026-06-22 08:00:00,TEMP-001\n"
        )
        collector = DataCollector(str(csv_file))
        with pytest.raises(ValueError, match="Missing required columns"):
            collector.load()

    def test_invalid_numeric_row_is_skipped(self, tmp_path):
        csv_file = tmp_path / "mixed.csv"
        csv_file.write_text(
            "timestamp,sensor_id,raw_value\n"
            "2026-06-22 08:00:00,TEMP-001,25.0\n"
            "2026-06-22 08:05:00,TEMP-001,NOT_A_NUMBER\n"
            "2026-06-22 08:10:00,TEMP-001,26.0\n"
        )
        collector = DataCollector(str(csv_file))
        data = collector.load()
        assert len(data) == 2
        assert data[0]["raw_value"] == 25.0
        assert data[1]["raw_value"] == 26.0

    def test_extra_columns_are_passthrough(self, tmp_path):
        csv_file = tmp_path / "extra.csv"
        csv_file.write_text(
            "timestamp,sensor_id,raw_value,location,unit,batch\n"
            "2026-06-22 08:00:00,TEMP-001,25.0,Zone_A,Celsius,B-101\n"
            "2026-06-22 08:05:00,PRESS-002,100.5,Hydraulic_1,kPa,B-102\n"
        )
        collector = DataCollector(str(csv_file))
        data = collector.load()
        assert len(data) == 2
        assert data[0]["location"] == "Zone_A"
        assert data[0]["unit"] == "Celsius"
        assert data[0]["batch"] == "B-101"
        assert data[1]["location"] == "Hydraulic_1"
        assert data[1]["unit"] == "kPa"
        assert data[1]["batch"] == "B-102"

    def test_empty_csv_raises_error(self, tmp_path):
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("timestamp,sensor_id,raw_value\n")
        collector = DataCollector(str(csv_file))
        with pytest.raises(ValueError, match="CSV file is empty"):
            collector.load()

    def test_raw_value_parsed_as_float(self, tmp_path):
        csv_file = tmp_path / "float.csv"
        csv_file.write_text(
            "timestamp,sensor_id,raw_value\n"
            "2026-06-22 08:00:00,TEMP-001,25.5\n"
            "2026-06-22 08:05:00,TEMP-001,100\n"
        )
        collector = DataCollector(str(csv_file))
        data = collector.load()
        assert isinstance(data[0]["raw_value"], float)
        assert data[0]["raw_value"] == 25.5
        assert isinstance(data[1]["raw_value"], float)
        assert data[1]["raw_value"] == 100.0

    def test_get_sensor_ids_unique_and_sorted(self, tmp_path):
        csv_file = tmp_path / "multi.csv"
        csv_file.write_text(
            "timestamp,sensor_id,raw_value\n"
            "2026-06-22 08:00:00,TEMP-001,25.0\n"
            "2026-06-22 08:00:00,PRESS-002,100.0\n"
            "2026-06-22 08:05:00,TEMP-001,26.0\n"
            "2026-06-22 08:05:00,FLOW-003,50.0\n"
        )
        collector = DataCollector(str(csv_file))
        ids = collector.get_sensor_ids()
        assert ids == ["FLOW-003", "PRESS-002", "TEMP-001"]

    def test_get_data_by_sensor_filters_correctly(self, tmp_path):
        csv_file = tmp_path / "multi.csv"
        csv_file.write_text(
            "timestamp,sensor_id,raw_value\n"
            "2026-06-22 08:00:00,TEMP-001,25.0\n"
            "2026-06-22 08:00:00,PRESS-002,100.0\n"
            "2026-06-22 08:05:00,TEMP-001,26.0\n"
        )
        collector = DataCollector(str(csv_file))
        temp_data = collector.get_data_by_sensor("TEMP-001")
        assert len(temp_data) == 2
        press_data = collector.get_data_by_sensor("PRESS-002")
        assert len(press_data) == 1
        assert all(r["sensor_id"] == "TEMP-001" for r in temp_data)
