#!/usr/bin/env python3
"""Server disk usage collector and capacity trend forecaster.

Usage:
    python disk_monitor.py collect    Collect current disk usage into CSV.
    python disk_monitor.py predict    Predict full-disk dates, write JSON report.
"""

import argparse
import sys

import config
from collector import collect_once
from predictor import predict_all


def fmt_bytes(num_bytes):
    return f"{num_bytes / config.GB:7.2f}GB"


def cmd_collect(_args):
    samples = collect_once()
    if not samples:
        print("[collect] No mount points were sampled.")
        return 1
    print(f"[collect] {len(samples)} mount point(s) sampled at {samples[0]['timestamp']}")
    for s in samples:
        print(
            f"  {s['mountpoint']:24s} {s['usage_percent']:6.2f}%  "
            f"used={fmt_bytes(s['used'])} / total={fmt_bytes(s['total'])}"
        )
    print(f"[collect] appended to {config.CSV_PATH}")
    return 0


def cmd_predict(_args):
    report = predict_all()
    print(f"[predict] overall status: {report['overall_status']}")
    print(f"[predict] report written to {config.REPORT_PATH}")
    if not report.get("partitions"):
        print(f"[predict] {report.get('message', 'No partitions to report.')}")
        return 0
    print()
    for p in report["partitions"]:
        status = p["status"].upper()
        full = p.get("full_date") or "-"
        days = p.get("days_until_full")
        days_str = f"{days:.1f} days" if days is not None else "-"
        print(
            f"  [{status:16s}] {p['mountpoint']:24s} "
            f"{p['usage_percent']:6.2f}%  full={full} ({days_str})"
        )
        print(f"    -> {p['message']}")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(
        prog="disk_monitor",
        description="Server disk usage collection and capacity trend prediction.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("collect", help="Collect current disk usage and append to CSV.")
    sub.add_parser("predict", help="Predict full-disk dates and write a JSON report.")
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "collect":
        return cmd_collect(args)
    if args.command == "predict":
        return cmd_predict(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
