"""Capacity trend analysis module.

Fits a least-squares linear regression to each partition's used-bytes
time series, projects the date the partition reaches capacity, and
emits a JSON capacity warning report.
"""

import csv
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta

import config


def load_samples():
    """Load samples from the CSV, grouped by mount point."""
    if not os.path.exists(config.CSV_PATH):
        return {}

    grouped = defaultdict(list)
    with open(config.CSV_PATH, "r", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            try:
                row["total"] = int(row["total"])
                row["used"] = int(row["used"])
                row["free"] = int(row["free"])
                row["usage_percent"] = float(row["usage_percent"])
                row["_dt"] = datetime.fromisoformat(row["timestamp"])
            except (ValueError, KeyError):
                continue
            grouped[row["mountpoint"]].append(row)
    return grouped


def linear_regression(xs, ys):
    """Ordinary least-squares fit. Returns (slope, intercept)."""
    n = len(xs)
    if n < 2:
        return 0.0, (sum(ys) / n) if n else 0.0
    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_x2 = sum(x * x for x in xs)
    denominator = n * sum_x2 - sum_x * sum_x
    if denominator == 0:
        return 0.0, sum_y / n
    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n
    return slope, intercept


def predict_partition(samples):
    """Project the full-disk date for a single partition's sample list."""
    samples.sort(key=lambda r: r["_dt"])
    latest = samples[-1]
    base_dt = samples[0]["_dt"]
    total = latest["total"]

    result = {
        "mountpoint": latest["mountpoint"],
        "device": latest["device"],
        "fstype": latest["fstype"],
        "total_bytes": total,
        "used_bytes": latest["used"],
        "free_bytes": latest["free"],
        "usage_percent": latest["usage_percent"],
        "samples": len(samples),
        "first_sample": base_dt.isoformat(),
        "last_sample": latest["_dt"].isoformat(),
        "trend_slope_bytes_per_day": 0.0,
        "full_date": None,
        "days_until_full": None,
        "status": "ok",
        "message": "",
    }

    if total <= 0:
        result["status"] = "unknown"
        result["message"] = "Total capacity is zero; cannot predict."
        return result

    xs = [(r["_dt"] - base_dt).total_seconds() / 86400.0 for r in samples]
    ys = [r["used"] for r in samples]
    slope, intercept = linear_regression(xs, ys)
    result["trend_slope_bytes_per_day"] = round(slope, 2)

    full_date = None
    days_until_full = None
    if slope > 0:
        days_from_base = (total - intercept) / slope
        projected_full = base_dt + timedelta(days=days_from_base)
        full_date = projected_full.date().isoformat()
        days_until_full = (projected_full - latest["_dt"]).total_seconds() / 86400.0
        result["full_date"] = full_date
        result["days_until_full"] = round(days_until_full, 1)

    if latest["usage_percent"] >= config.WARN_CRITICAL_PERCENT:
        result["status"] = "critical"
        result["message"] = (
            f"Current usage {latest['usage_percent']:.2f}% is at/above the "
            f"{config.WARN_CRITICAL_PERCENT:.0f}% critical threshold."
        )
    elif full_date is None:
        result["status"] = "ok"
        result["message"] = "Usage is stable or decreasing; no projected full-disk date."
    elif days_until_full <= 0:
        result["status"] = "critical"
        result["message"] = (
            f"Trend projects the disk reaching capacity by {full_date} "
            f"(overdue relative to the latest sample)."
        )
    elif days_until_full <= config.CRITICAL_DAYS:
        result["status"] = "critical"
        result["message"] = (
            f"Projected to be full on {full_date} (in {days_until_full:.1f} days) — imminent."
        )
    elif days_until_full <= config.WARNING_DAYS:
        result["status"] = "warning"
        result["message"] = f"Projected to be full on {full_date} (in {days_until_full:.1f} days)."
    else:
        result["status"] = "ok"
        result["message"] = f"Projected to be full on {full_date} (in {days_until_full:.1f} days)."

    return result


def build_insufficient_report(mountpoint, samples):
    latest = samples[-1]
    return {
        "mountpoint": mountpoint,
        "device": latest["device"],
        "fstype": latest["fstype"],
        "total_bytes": latest["total"],
        "used_bytes": latest["used"],
        "free_bytes": latest["free"],
        "usage_percent": latest["usage_percent"],
        "samples": len(samples),
        "first_sample": samples[0]["_dt"].isoformat() if samples else None,
        "last_sample": latest["_dt"].isoformat(),
        "trend_slope_bytes_per_day": 0.0,
        "full_date": None,
        "days_until_full": None,
        "status": "insufficient_data",
        "message": (
            f"Only {len(samples)} sample(s) collected; need at least "
            f"{config.MIN_SAMPLES_FOR_PREDICTION} to fit a trend."
        ),
    }


def predict_all():
    """Predict full-disk dates for all partitions and write the JSON report."""
    grouped = load_samples()

    if not grouped:
        report = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "overall_status": "unknown",
            "partitions": [],
            "message": "No data collected yet. Run 'python disk_monitor.py collect' first.",
        }
        os.makedirs(config.DATA_DIR, exist_ok=True)
        with open(config.REPORT_PATH, "w") as fh:
            json.dump(report, fh, indent=2, ensure_ascii=False)
        return report

    results = []
    for mountpoint, samples in grouped.items():
        if len(samples) < config.MIN_SAMPLES_FOR_PREDICTION:
            results.append(build_insufficient_report(mountpoint, samples))
        else:
            results.append(predict_partition(list(samples)))

    results.sort(key=lambda r: (r.get("days_until_full") is None, r.get("days_until_full") or 0.0))

    statuses = [r["status"] for r in results]
    if "critical" in statuses:
        overall = "critical"
    elif "warning" in statuses:
        overall = "warning"
    elif "insufficient_data" in statuses:
        overall = "insufficient_data"
    else:
        overall = "ok"

    report = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "overall_status": overall,
        "partitions": results,
    }

    os.makedirs(config.DATA_DIR, exist_ok=True)
    with open(config.REPORT_PATH, "w") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    return report
