#!/usr/bin/env python3
"""cron_audit.py – Crontab health audit & execution-log analysis CLI.

Usage
-----
    python cron_audit.py scan   [--db PATH] [--crontab FILE ...]
                                [--log FILE ...] [--no-user-crontab] [--json]

    python cron_audit.py report  [--db PATH] [--scan-id ID] [--json]

    python cron_audit.py history [--db PATH] [--fingerprint FP]

The *scan* command discovers crontab entries, validates them, parses
syslog for execution records and persists everything to SQLite.  The
*report* command reads the latest (or specified) scan and prints a
health report.
"""

from __future__ import annotations

import argparse
import json as jsonlib
import os
import sys
from datetime import datetime, timedelta
from typing import List, Optional

from database import Database, DEFAULT_DB_PATH
from log_analyzer import LogAnalyzer
from models import (
    ReportRecord,
    TaskEntry,
    TaskStats,
    TaskStatus,
    ValidationResult,
)
from scanner import CronScanner
from validator import CronValidator

# ANSI colour helpers (disabled when output is not a TTY).
_USE_COLOR = sys.stdout.isatty()

def _c(text: str, color: str) -> str:
    if not _USE_COLOR:
        return text
    codes = {
        "green": "32", "yellow": "33", "red": "31",
        "cyan": "36", "bold": "1", "dim": "2",
    }
    return f"\033[{codes.get(color, '')}m{text}\033[0m"


def _status_color(status: str) -> str:
    return {
        "OK": "green", "WARNING": "yellow", "ERROR": "red",
        "UNKNOWN": "dim",
    }.get(status, "")


# ---------------------------------------------------------------------- #
# scan command
# ---------------------------------------------------------------------- #
def cmd_scan(args: argparse.Namespace) -> int:
    db = Database(args.db)
    scan_id = Database.new_scan_id()

    # 1. Scan crontab files
    sources = args.crontab if args.crontab else None
    scanner = CronScanner(
        sources=sources,
        include_user_crontab=not args.no_user_crontab,
        force_system=args.system,
    )
    tasks = scanner.scan()

    # 2. Validate tasks
    validator = CronValidator()
    validations = validator.validate_all(tasks)

    # 3. Analyze execution logs
    log_paths = args.log if args.log else None
    analyzer = LogAnalyzer(log_paths=log_paths)
    since = datetime.now() - timedelta(days=args.days) if args.days else None
    records, stats = analyzer.analyze(tasks, since=since)

    # 4. Persist
    db.save_scan(scan_id, tasks, validations, records, stats)

    # 5. Generate & persist report
    report = _build_report(scan_id, tasks, validations, stats)
    db.save_report(scan_id, report)

    if args.json:
        _print_scan_json(scan_id, tasks, validations, stats)
    else:
        _print_scan_table(scan_id, tasks, validations, stats)

    db.close()
    return 0


def _print_scan_table(
    scan_id: str,
    tasks: List[TaskEntry],
    validations: List[ValidationResult],
    stats: List[TaskStats],
) -> None:
    stats_map = {s.fingerprint: s for s in stats}
    print(_c("=" * 90, "dim"))
    print(_c(f"  CRON AUDIT – SCAN  (scan_id: {scan_id})", "bold"))
    print(_c(f"  Generated: {datetime.now():%Y-%m-%d %H:%M:%S}", "dim"))
    print(_c(f"  Tasks found: {len(tasks)}", "dim"))
    print(_c("=" * 90, "dim"))

    if not tasks:
        print("  No crontab entries found.")
        print()
        print("  This may mean:")
        print("    - No system crontab exists (/etc/crontab, /etc/cron.d/)")
        print("    - No per-user crontabs are configured")
        print("    - The current user has no crontab (run 'crontab -l' to verify)")
        print()
        print("  Try scanning a specific file:")
        print("    python cron_audit.py scan --crontab /path/to/crontab")
        return

    header = (
        f"{'#':<3} {'STATUS':<8} {'SCHEDULE':<15} {'USER':<10} "
        f"{'COMMAND':<35} {'ISSUES':<20}"
    )
    print(_c(header, "bold"))
    print(_c("-" * 90, "dim"))

    for i, v in enumerate(validations, 1):
        status_str = _c(v.status.value, _status_color(v.status.value))
        cmd = v.task.command[:33] + ".." if len(v.task.command) > 35 else v.task.command
        user = (v.task.user or "-")[:9]
        issues = "; ".join(v.issues)[:18] + ".." if v.issues and len("; ".join(v.issues)) > 20 else "; ".join(v.issues) or "-"
        sched = v.task.cron_expression[:14]
        print(f"{i:<3} {status_str:<8} {sched:<15} {user:<10} {cmd:<35} {issues:<20}")

    print()
    _print_summary(validations, stats_map)


def _print_summary(
    validations: List[ValidationResult],
    stats_map: dict,
) -> None:
    ok = sum(1 for v in validations if v.status == TaskStatus.OK)
    warn = sum(1 for v in validations if v.status == TaskStatus.WARNING)
    err = sum(1 for v in validations if v.status == TaskStatus.ERROR)
    total = len(validations)

    print(_c("-" * 90, "dim"))
    print(_c("  SUMMARY", "bold"))
    print(f"    Total tasks : {total}")
    print(f"    {_c('OK', 'green'):<10} : {ok}")
    print(f"    {_c('WARNING', 'yellow'):<10} : {warn}")
    print(f"    {_c('ERROR', 'red'):<10} : {err}")

    if stats_map:
        print()
        print(_c("  EXECUTION STATS (from syslog)", "bold"))
        for fp, s in stats_map.items():
            rate = f"{s.success_rate:.1%}" if s.success_rate is not None else "N/A"
            avg = f"{s.avg_duration:.2f}s" if s.avg_duration is not None else "N/A"
            last = s.last_run.strftime("%Y-%m-%d %H:%M") if s.last_run else "N/A"
            print(f"    runs={s.total_runs:<4} success={rate:<6} "
                  f"avg_dur={avg:<8} last={last}  fp={fp[:40]}")
    print()


def _print_scan_json(
    scan_id: str,
    tasks: List[TaskEntry],
    validations: List[ValidationResult],
    stats: List[TaskStats],
) -> None:
    stats_map = {s.fingerprint: s for s in stats}
    output = {
        "scan_id": scan_id,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "total_tasks": len(tasks),
        "tasks": [],
        "stats": [s.__dict__ for s in stats],
    }
    for v in validations:
        s = stats_map.get(v.task.fingerprint())
        output["tasks"].append({
            **v.to_dict(),
            "execution": {
                "total_runs": s.total_runs if s else 0,
                "success_rate": s.success_rate if s else None,
                "avg_duration": s.avg_duration if s else None,
                "last_run": s.last_run.isoformat() if s and s.last_run else None,
            } if s else None,
        })
    print(jsonlib.dumps(output, default=str, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------- #
# report command
# ---------------------------------------------------------------------- #
def cmd_report(args: argparse.Namespace) -> int:
    db = Database(args.db)

    if args.scan_id:
        scan_id = args.scan_id
    else:
        scan_id = db.get_latest_scan_id()
        if not scan_id:
            print("No scans found in the database. Run 'cron_audit.py scan' first.")
            db.close()
            return 1

    validations = db.get_validations(scan_id)
    task_stats = db.get_task_stats(scan_id)
    report = db.get_report(scan_id)

    if not validations:
        print(f"No data for scan_id '{scan_id}'.")
        db.close()
        return 1

    if args.json:
        _print_report_json(scan_id, validations, task_stats, report)
    else:
        _print_report_human(scan_id, validations, task_stats, report)

    db.close()
    return 0


def _print_report_human(
    scan_id: str,
    validations: list,
    task_stats: list,
    report: Optional[dict],
) -> None:
    stats_map = {s["fingerprint"]: s for s in task_stats}
    total = len(validations)
    ok = sum(1 for v in validations if v["status"] == "OK")
    warn = sum(1 for v in validations if v["status"] == "WARNING")
    err = sum(1 for v in validations if v["status"] == "ERROR")
    score = (ok + 0.5 * warn) / total * 100 if total else 100.0

    print(_c("=" * 90, "dim"))
    print(_c("  CRON HEALTH REPORT", "bold"))
    print(_c(f"  scan_id: {scan_id}", "dim"))
    print(_c("=" * 90, "dim"))
    print()
    print(_c("  OVERALL HEALTH SCORE", "bold"))
    bar_len = 40
    filled = int(score / 100 * bar_len)
    bar = _c("=" * filled, "green" if score >= 75 else "yellow" if score >= 50 else "red")
    bar += _c("-" * (bar_len - filled), "dim")
    score_color = "green" if score >= 75 else "yellow" if score >= 50 else "red"
    print(f"  {bar} {_c(f'{score:.1f}%', score_color)}")
    print()
    print(_c("  SUMMARY", "bold"))
    print(f"    Total tasks   : {total}")
    print(f"    {_c('Healthy (OK)', 'green'):<15} : {ok}")
    print(f"    {_c('Warnings', 'yellow'):<15} : {warn}")
    print(f"    {_c('Errors', 'red'):<15} : {err}")
    print()

    if err > 0:
        print(_c("  ERRORS (require attention)", "bold"))
        for v in validations:
            if v["status"] != "ERROR":
                continue
            _print_task_detail(v, stats_map.get(v["task_fingerprint"]))
        print()

    if warn > 0:
        print(_c("  WARNINGS", "bold"))
        for v in validations:
            if v["status"] != "WARNING":
                continue
            _print_task_detail(v, stats_map.get(v["task_fingerprint"]))
        print()

    print(_c("  ALL TASKS", "bold"))
    print(_c(f"  {'#':<3} {'STATUS':<8} {'SCHEDULE':<14} {'USER':<8} "
            f"{'RUNS':<6} {'SUCCESS':<8} {'CMD':<30}", "dim"))
    for i, v in enumerate(validations, 1):
        fp = v["task_fingerprint"]
        s = stats_map.get(fp)
        status = _c(v["status"], _status_color(v["status"]))
        runs = str(s["total_runs"]) if s else "-"
        rate = f"{s['success_rate']:.0%}" if s and s["success_rate"] is not None else "-"
        cmd = v["command"][:28] + ".." if len(v["command"]) > 30 else v["command"]
        user = (v.get("user") or "-")[:7]
        print(f"  {i:<3} {status:<8} {v['cron_expression']:<14} {user:<8} "
              f"{runs:<6} {rate:<8} {cmd:<30}")
    print()

    # Recommendations
    recs = _generate_recommendations(validations, stats_map)
    if recs:
        print(_c("  RECOMMENDATIONS", "bold"))
        for rec in recs:
            print(f"    - {rec}")
        print()


def _print_task_detail(v: dict, stats: Optional[dict]) -> None:
    print(f"  [{v['status']}] {v['cron_expression']} | {v['command'][:50]}")
    if v.get("user"):
        print(f"    user: {v['user']}")
    if v.get("script_path"):
        exists = "exists" if v.get("script_exists") else "MISSING"
        exec_ = "executable" if v.get("is_executable") else "NOT executable"
        print(f"    script: {v['script_path']} ({exists}, {exec_})")
    if v.get("issues"):
        print(f"    issues: {v['issues']}")
    if v.get("cron_expression_errors"):
        print(f"    cron errors: {v['cron_expression_errors']}")
    if stats:
        rate = stats["success_rate"]
        rate_str = f"{rate:.1%}" if rate is not None else "N/A"
        avg = stats["avg_duration"]
        avg_str = f"{avg:.2f}s" if avg is not None else "N/A"
        print(f"    runs: {stats['total_runs']}  "
              f"success: {rate_str}  avg_dur: {avg_str}")
    print()


def _print_report_json(
    scan_id: str,
    validations: list,
    task_stats: list,
    report: Optional[dict],
) -> None:
    stats_map = {s["fingerprint"]: s for s in task_stats}
    total = len(validations)
    ok = sum(1 for v in validations if v["status"] == "OK")
    warn = sum(1 for v in validations if v["status"] == "WARNING")
    err = sum(1 for v in validations if v["status"] == "ERROR")
    score = (ok + 0.5 * warn) / total * 100 if total else 100.0

    output = {
        "scan_id": scan_id,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "overall_health_score": round(score, 1),
        "summary": {"total": total, "ok": ok, "warning": warn, "error": err},
        "tasks": [],
    }
    for v in validations:
        fp = v["task_fingerprint"]
        output["tasks"].append({
            "status": v["status"],
            "schedule": v["cron_expression"],
            "user": v.get("user"),
            "command": v["command"],
            "script_path": v.get("script_path"),
            "script_exists": v.get("script_exists"),
            "is_executable": v.get("is_executable"),
            "permission_octal": v.get("permission_octal"),
            "issues": v.get("issues"),
            "cron_errors": v.get("cron_expression_errors"),
            "execution": stats_map.get(fp),
        })
    print(jsonlib.dumps(output, default=str, indent=2, ensure_ascii=False))


def _generate_recommendations(validations: list, stats_map: dict) -> List[str]:
    recs: List[str] = []
    for v in validations:
        fp = v["task_fingerprint"]
        if v["status"] == "ERROR":
            if v.get("script_exists") is False:
                recs.append(f"Fix or remove task with missing script: {v.get('script_path', '?')}")
            if not v.get("cron_expression_valid", True):
                recs.append(f"Fix invalid cron expression: {v['cron_expression']}")
            if v.get("is_executable") is False and v.get("script_exists"):
                recs.append(f"Add execute permission: chmod +x {v.get('script_path', '?')}")
        s = stats_map.get(fp)
        if s and s.get("success_rate") is not None and s["success_rate"] < 0.9:
            rate = s["success_rate"]
            recs.append(
                f"Task '{v['command'][:40]}' has low success rate ({rate:.0%}) "
                f"- {s['failure_count']} failures in {s['total_runs']} runs"
            )
    return recs


def _build_report(
    scan_id: str,
    tasks: List[TaskEntry],
    validations: List[ValidationResult],
    stats: List[TaskStats],
) -> ReportRecord:
    stats_map = {s.fingerprint: s for s in stats}
    ok = sum(1 for v in validations if v.status == TaskStatus.OK)
    warn = sum(1 for v in validations if v.status == TaskStatus.WARNING)
    err = sum(1 for v in validations if v.status == TaskStatus.ERROR)
    total = len(validations)
    score = (ok + 0.5 * warn) / total * 100 if total else 100.0

    details = []
    for v in validations:
        s = stats_map.get(v.task.fingerprint())
        details.append({
            **v.to_dict(),
            "execution": {
                "total_runs": s.total_runs if s else 0,
                "success_rate": s.success_rate if s else None,
                "avg_duration": s.avg_duration if s else None,
                "last_run": s.last_run.isoformat() if s and s.last_run else None,
            } if s else None,
        })

    return ReportRecord(
        created_at=datetime.now(),
        total_tasks=total,
        healthy_tasks=ok,
        warning_tasks=warn,
        error_tasks=err,
        overall_health_score=round(score, 1),
        details=details,
    )


# ---------------------------------------------------------------------- #
# history command
# ---------------------------------------------------------------------- #
def cmd_history(args: argparse.Namespace) -> int:
    db = Database(args.db)
    scans = db.list_latest_scans(limit=20)
    if not scans:
        print("No scans found in the database.")
        db.close()
        return 1

    print(_c("=" * 70, "dim"))
    print(_c("  SCAN HISTORY", "bold"))
    print(_c("=" * 70, "dim"))
    print(f"  {'scan_id':<14} {'created_at':<22} {'validations'}")
    print(_c("-" * 70, "dim"))
    for s in scans:
        vals = db.get_validations(s["scan_id"])
        ok = sum(1 for v in vals if v["status"] == "OK")
        warn = sum(1 for v in vals if v["status"] == "WARNING")
        err = sum(1 for v in vals if v["status"] == "ERROR")
        print(f"  {s['scan_id']:<14} {s['created_at']:<22} "
              f"{_c('OK', 'green')}={ok} {_c('WARN', 'yellow')}={warn} {_c('ERR', 'red')}={err}")

    if args.fingerprint:
        print()
        print(_c(f"  HISTORY for: {args.fingerprint}", "bold"))
        print(_c("-" * 70, "dim"))
        history = db.get_task_history(args.fingerprint)
        if not history:
            print("  No historical data for this fingerprint.")
        else:
            for h in history:
                rate = h.get("success_rate")
                rate_str = f"{rate:.1%}" if rate is not None else "N/A"
                print(f"  {h['created_at']:<22} runs={h['total_runs']:<4} "
                      f"success={rate_str:<6} status={h.get('status', '?')}")
    print()
    db.close()
    return 0


# ---------------------------------------------------------------------- #
# argument parsing
# ---------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cron_audit.py",
        description="Crontab health audit & execution-log analysis tool.",
    )
    parser.add_argument(
        "--db", default=DEFAULT_DB_PATH,
        help=f"SQLite database path (default: {DEFAULT_DB_PATH})",
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # scan
    p_scan = sub.add_parser("scan", help="Scan crontab files and store results")
    p_scan.add_argument(
        "--crontab", nargs="*", metavar="FILE",
        help="Specific crontab file(s) or directories to scan "
             "(default: auto-detect system + user crontabs)",
    )
    p_scan.add_argument(
        "--log", nargs="*", metavar="FILE",
        help="Specific log file(s) to parse (default: auto-detect syslog)",
    )
    p_scan.add_argument(
        "--no-user-crontab", action="store_true",
        help="Do not include the current user's crontab (-l output)",
    )
    p_scan.add_argument(
        "--system", action="store_true",
        help="Treat all --crontab files as system crontabs (with user field)",
    )
    p_scan.add_argument(
        "--days", type=int, default=7,
        help="Only parse log entries from the last N days (default: 7)",
    )
    p_scan.add_argument("--json", action="store_true", help="Output as JSON")

    # report
    p_report = sub.add_parser("report", help="Print a health report from stored data")
    p_report.add_argument(
        "--scan-id", metavar="ID",
        help="Specific scan ID to report on (default: latest)",
    )
    p_report.add_argument("--json", action="store_true", help="Output as JSON")

    # history
    p_hist = sub.add_parser("history", help="List previous scans")
    p_hist.add_argument(
        "--fingerprint", metavar="FP",
        help="Show historical stats for a specific task fingerprint",
    )

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "scan":
        return cmd_scan(args)
    elif args.command == "report":
        return cmd_report(args)
    elif args.command == "history":
        return cmd_history(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
