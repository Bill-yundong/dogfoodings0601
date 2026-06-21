#!/usr/bin/env python3
"""dns_audit — DNS record drift inspection tool.

Usage:
    python dns_audit.py scan --baseline zones.yaml

The tool loads expected A/CNAME/MX records from a YAML baseline file,
queries live DNS via raw UDP sockets, classifies any discrepancies
(missing / added / tampered), persists drift history to a JSON state
file for consecutive-day tracking, and prints a grouped report.
"""

import argparse
import sys
from datetime import datetime

from baseline import BaselineLoader
from detector import DNSDetector
from diff_engine import DiffEngine
from reporter import Reporter
from state import StateManager


def cmd_scan(args):
    loader = BaselineLoader(args.baseline)
    baseline = loader.load()

    nameserver = args.nameserver or baseline.nameserver
    timeout = args.timeout if args.timeout is not None else baseline.timeout

    detector = DNSDetector(server=nameserver, timeout=timeout)

    all_domains = baseline.domains()
    drifts_by_domain = {}

    for domain in all_domains:
        try:
            expected = baseline.zones[domain]
            record_types = list(expected.keys())
            if not record_types:
                continue

            actual = detector.probe(domain, record_types)
            drifts = DiffEngine.compare(expected, actual)
            if drifts:
                drifts_by_domain[domain] = drifts
        except Exception as exc:
            print(
                f"[WARN] 扫描域名 {domain} 时发生异常: "
                f"{type(exc).__name__}: {exc}",
                file=sys.stderr,
            )
            continue

    scan_time = datetime.now()
    state_mgr = StateManager(args.state)
    state_mgr.update(drifts_by_domain, scan_time)
    state_mgr.save()

    reporter = Reporter(args.baseline)
    report = reporter.generate(drifts_by_domain, state_mgr.state, all_domains)
    print(report)


def main():
    parser = argparse.ArgumentParser(
        prog="dns_audit",
        description="DNS 记录漂移巡检工具 — 检测实际 DNS 与基线声明的差异",
    )
    sub = parser.add_subparsers(dest="command")

    scan_p = sub.add_parser("scan", help="执行 DNS 漂移扫描")
    scan_p.add_argument(
        "--baseline", "-b",
        required=True,
        help="基线 YAML 声明文件路径",
    )
    scan_p.add_argument(
        "--state", "-s",
        default=".dns_audit_state.json",
        help="状态持久化文件路径 (默认: .dns_audit_state.json)",
    )
    scan_p.add_argument(
        "--nameserver", "-n",
        default=None,
        help="覆盖基线文件中的 DNS 服务器地址",
    )
    scan_p.add_argument(
        "--timeout", "-t",
        type=int,
        default=None,
        help="覆盖基线文件中的 DNS 超时秒数",
    )

    args = parser.parse_args()

    if args.command == "scan":
        try:
            cmd_scan(args)
        except FileNotFoundError as exc:
            print(f"错误: {exc}", file=sys.stderr)
            sys.exit(1)
        except Exception as exc:
            print(f"运行时错误: {exc}", file=sys.stderr)
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
