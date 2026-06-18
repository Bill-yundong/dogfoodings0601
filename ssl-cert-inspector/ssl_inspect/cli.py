"""Command-line entry point and full inspection orchestration.

Invoked via the top-level ``inspect.py`` launcher::

    python inspect.py --config domains.yaml

Pipeline:
    1. Load the YAML config (domains + thresholds + smtp + paths).
    2. Inspect every domain concurrently, pulling each cert chain and
       classifying it by remaining days.
    3. Persist all records to SQLite for trend tracing.
    4. Write a structured JSON report.
    5. Trigger email alerts for any domain within the warning/critical/
       expired thresholds (writes an .eml file; sends via SMTP if enabled).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Dict, List, Optional

from ssl_inspect.alerter import handle_alerts
from ssl_inspect.config import ensure_output_dirs, load_config
from ssl_inspect.inspector import (
    LEVEL_CRITICAL,
    LEVEL_ERROR,
    LEVEL_EXPIRED,
    LEVEL_SAFE,
    LEVEL_WARNING,
    inspect_domains,
)
from ssl_inspect.reporter import build_report, write_report
from ssl_inspect.storage import InspectionStore


_LEVEL_ICON = {
    LEVEL_EXPIRED: "X",
    LEVEL_CRITICAL: "!",
    LEVEL_WARNING: "~",
    LEVEL_SAFE: "OK",
    LEVEL_ERROR: "?",
}


def _progress(result: Dict, index_holder: List[int]) -> None:
    index_holder[0] += 1
    idx = index_holder[0]
    icon = _LEVEL_ICON.get(result["level"], "?")
    if result["status"] == "error":
        print(f"  [{idx:2d}] [{icon}] {result['domain']}:{result['port']} "
              f"-> ERROR ({result['error']})")
    else:
        remaining = result.get("remaining_days")
        if remaining is not None and remaining >= 0:
            remaining_str = f"{remaining}d"
        elif remaining is not None:
            remaining_str = "expired"
        else:
            remaining_str = "?"
        print(f"  [{idx:2d}] [{icon}] {result['domain']}:{result['port']} "
              f"-> {result['level'].upper()} ({remaining_str})")


def _print_summary(report: Dict, elapsed: float) -> None:
    summary = report["summary"]
    by_level = summary["by_level"]
    th = report["thresholds"]
    print()
    print("=" * 60)
    print("SSL CERTIFICATE INSPECTION REPORT")
    print("=" * 60)
    print(f"Generated at  : {report['generated_at']}")
    print(f"Duration       : {elapsed:.2f}s")
    print(f"Total domains  : {summary['total']}")
    print(f"  safe        : {by_level[LEVEL_SAFE]}")
    print(f"  warning     : {by_level[LEVEL_WARNING]}  (<= {th['warning']} days)")
    print(f"  critical    : {by_level[LEVEL_CRITICAL]}  (<= {th['critical']} days)")
    print(f"  expired     : {by_level[LEVEL_EXPIRED]}")
    print(f"  errors      : {by_level[LEVEL_ERROR]}")
    print(f"Alerts to send: {summary['alerts']}")
    print("=" * 60)


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect SSL certificates and alert on near-expiry domains."
    )
    parser.add_argument(
        "--config", "-c",
        required=True,
        help="Path to the YAML config file (e.g. domains.yaml).",
    )
    parser.add_argument(
        "--no-alert",
        action="store_true",
        help="Skip email alert generation even if thresholds are breached.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    config_path = os.path.abspath(args.config)

    try:
        config = load_config(config_path)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        return 2

    ensure_output_dirs(config)

    print(f"Inspecting {len(config.domains)} domain(s) "
          f"(timeout={config.inspection.timeout}s, "
          f"concurrency={config.inspection.concurrency}, "
          f"retries={config.inspection.max_retries})...")
    start = time.time()
    index_holder = [0]
    results = inspect_domains(
        domains=config.domains,
        thresholds=config.thresholds,
        timeout=config.inspection.timeout,
        concurrency=config.inspection.concurrency,
        max_retries=config.inspection.max_retries,
        retry_backoff=config.inspection.retry_backoff,
        progress=lambda r: _progress(r, index_holder),
    )
    elapsed = time.time() - start

    store = InspectionStore(config.database_path)
    saved = store.save_many(results)
    print(f"\nSaved {saved} record(s) to SQLite: {config.database_path}")

    report = build_report(results, config)
    report_path = write_report(report, config.report_path)
    print(f"JSON report written: {report_path}")

    _print_summary(report, elapsed)

    if args.no_alert:
        print("\nAlert generation skipped (--no-alert).")
    else:
        alert_result = handle_alerts(results, config)
        print("\n" + "-" * 60)
        print("ALERT EMAIL")
        print("-" * 60)
        print(f"Subject : {alert_result['subject']}")
        print(f"Alerts  : {alert_result['alert_count']} "
              f"(expired={alert_result['counts'][LEVEL_EXPIRED]}, "
              f"critical={alert_result['counts'][LEVEL_CRITICAL]}, "
              f"warning={alert_result['counts'][LEVEL_WARNING]})")
        print(f"EML file: {alert_result['eml_path']}")
        smtp = alert_result["smtp"]
        if smtp["sent"]:
            print(f"SMTP    : delivered to {config.alert.smtp.to}")
        elif config.alert.smtp.enabled:
            print(f"SMTP    : FAILED -> {smtp['error']}")
        else:
            print("SMTP    : disabled (enable alert.smtp.enabled to send real mail)")
        print("-" * 60)
        print("ALERT EMAIL BODY:")
        print(alert_result["body"])

    total_in_db = store.count()
    print(f"\nTotal historical records in DB: {total_in_db}")
    print("Done.")
    return 0
