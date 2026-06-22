#!/usr/bin/env python3
"""Main CLI entry point for sensor calibration and drift detection pipeline."""

import argparse
import os
import sys
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    CalibrationEngine,
    DataCollector,
    DriftDetector,
    generate_timestamp,
    save_csv,
    save_json,
    setup_logger,
)

logger = setup_logger("calibration_pipeline")


def run_pipeline(
    raw_csv_path: str,
    calibration_json_path: str,
    window_size: int = 10,
    consecutive_alerts: int = 3,
    output_dir: str = "output",
) -> Dict:
    timestamp = generate_timestamp()

    logger.info("=" * 60)
    logger.info("Starting Sensor Calibration and Drift Detection Pipeline")
    logger.info("=" * 60)

    collector = DataCollector(raw_csv_path)
    raw_data = collector.load()

    calibrator = CalibrationEngine(calibration_json_path)
    calibrated_data = calibrator.calibrate(raw_data)

    drift_detector = DriftDetector(
        window_size=window_size,
        consecutive_alerts=consecutive_alerts,
    )
    analyzed_data, alerts = drift_detector.detect(
        calibrated_data,
        calibrator.baseline_values,
        calibrator.tolerance,
    )

    calibrated_output_path = os.path.join(
        output_dir, "calibrated", f"calibrated_data_{timestamp}.csv"
    )
    calibrated_fieldnames = list(analyzed_data[0].keys()) if analyzed_data else []
    save_csv(analyzed_data, calibrated_output_path, calibrated_fieldnames)
    logger.info(f"Calibrated data saved to: {calibrated_output_path}")

    alerts_output_path = os.path.join(
        output_dir, "alerts", f"drift_alerts_{timestamp}.json"
    )
    alerts_data = {
        "pipeline_run_timestamp": timestamp,
        "window_size": window_size,
        "consecutive_alerts_threshold": consecutive_alerts,
        "total_records_processed": len(analyzed_data),
        "total_alerts": len(alerts),
        "alerts_summary": _generate_alerts_summary(alerts),
        "alerts": alerts,
    }
    save_json(alerts_data, alerts_output_path)
    logger.info(f"Drift alerts saved to: {alerts_output_path}")

    _print_results(analyzed_data, alerts, calibrated_output_path, alerts_output_path)

    return {
        "calibrated_data": analyzed_data,
        "alerts": alerts,
        "calibrated_output_path": calibrated_output_path,
        "alerts_output_path": alerts_output_path,
        "timestamp": timestamp,
    }


def _generate_alerts_summary(alerts: List[Dict]) -> Dict:
    summary = {}
    for alert in alerts:
        sensor_id = alert["sensor_id"]
        severity = alert["severity"]
        if sensor_id not in summary:
            summary[sensor_id] = {"total": 0, "warning": 0, "critical": 0}
        summary[sensor_id]["total"] += 1
        summary[sensor_id][severity] += 1
    return summary


def _print_results(
    analyzed_data: List[Dict],
    alerts: List[Dict],
    calibrated_path: str,
    alerts_path: str,
) -> None:
    print("\n" + "=" * 80)
    print("CALIBRATION RESULTS")
    print("=" * 80)

    print("\n--- Calibrated Sensor Data (First 10 Records) ---")
    display_fields = [
        "timestamp",
        "sensor_id",
        "raw_value",
        "calibrated_value",
        "baseline_value",
        "window_mean",
        "relative_deviation",
        "is_suspected_aging",
        "alert_severity",
    ]
    print(" | ".join(f"{f:<18}" for f in display_fields))
    print("-" * 150)
    for row in analyzed_data[:10]:
        values = []
        for f in display_fields:
            val = row.get(f, "")
            if isinstance(val, float):
                val = f"{val:.4f}"
            values.append(f"{str(val):<18}")
        print(" | ".join(values))
    if len(analyzed_data) > 10:
        print(f"... and {len(analyzed_data) - 10} more records")

    print("\n" + "=" * 80)
    print("DRIFT ALERT SUMMARY")
    print("=" * 80)

    if alerts:
        print(f"\nTotal alerts: {len(alerts)}")
        print("\n--- Full Alert List ---")
        for i, alert in enumerate(alerts, 1):
            print(f"\n[{i}] {alert['alert_type'].upper()} - {alert['severity'].upper()}")
            print(f"    Timestamp: {alert['timestamp']}")
            print(f"    Sensor ID: {alert['sensor_id']}")
            print(f"    Baseline: {alert['baseline_value']:.4f}")
            print(f"    Window Mean: {alert['window_mean']:.4f}")
            print(f"    Deviation: {alert['relative_deviation'] * 100:.1f}% (tolerance: {alert['tolerance'] * 100:.1f}%)")
            print(f"    Message: {alert['message']}")
    else:
        print("\nNo drift alerts detected. All sensors operating within normal parameters.")

    print("\n" + "=" * 80)
    print("OUTPUT FILES")
    print("=" * 80)
    print(f"\nCalibrated data: {calibrated_path}")
    print(f"Drift alerts:    {alerts_path}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Industrial Sensor Calibration and Drift Detection Pipeline"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    run_parser = subparsers.add_parser("run", help="Run the calibration pipeline")
    run_parser.add_argument(
        "--raw", required=True, help="Path to raw sensor data CSV file"
    )
    run_parser.add_argument(
        "--cal", required=True, help="Path to calibration configuration JSON file"
    )
    run_parser.add_argument(
        "--window-size",
        type=int,
        default=10,
        help="Sliding window size for drift detection (default: 10)",
    )
    run_parser.add_argument(
        "--consecutive-alerts",
        type=int,
        default=3,
        help="Consecutive out-of-tolerance readings before alert (default: 3)",
    )
    run_parser.add_argument(
        "--output-dir",
        default="output",
        help="Output directory for results (default: output)",
    )

    args = parser.parse_args()

    if args.command == "run":
        try:
            run_pipeline(
                raw_csv_path=args.raw,
                calibration_json_path=args.cal,
                window_size=args.window_size,
                consecutive_alerts=args.consecutive_alerts,
                output_dir=args.output_dir,
            )
        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}")
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
