#!/usr/bin/env python3
import argparse
import sys
from typing import Dict, Any, List

from baseline_loader import BaselineLoader
from dns_probe import DNSProbe
from diff_engine import DiffEngine
from report_manager import ReportManager


def cmd_scan(args: argparse.Namespace) -> int:
    try:
        loader = BaselineLoader(args.baseline)
    except Exception as e:
        print(f"[ERROR] 加载基线文件失败: {e}", file=sys.stderr)
        return 1

    zones = loader.all_zones()
    if not zones:
        print("[WARN] 基线文件中没有配置任何域名", file=sys.stderr)
        return 0

    probe = DNSProbe(
        resolver=args.resolver,
        timeout=args.timeout,
        retries=args.retries,
    )

    print(f"[INFO] 开始对 {len(zones)} 个域名进行 DNS 巡检...")
    print(f"[INFO] DNS 解析器: {args.resolver}")
    print()

    all_probe_results: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for zone_name, records in zones.items():
        print(f"  → 探测 {zone_name} ...")
        record_types = list(records.keys())
        probe_result = probe.resolve_zone(zone_name, record_types)
        all_probe_results[zone_name] = probe_result

        for rtype, result in probe_result.items():
            if result.get("error"):
                print(f"      {rtype}: 错误 - {result['error']}")
            else:
                vals = result.get("values", [])
                print(f"      {rtype}: {len(vals)} 条记录")

    print()
    print("[INFO] 差异比对中...")

    engine = DiffEngine()
    diff_results = engine.compare_all(zones, all_probe_results)

    print("[INFO] 生成报告...")
    manager = ReportManager()
    manager.update_state(diff_results)
    report = manager.build_report(diff_results)

    output = ReportManager.render_console(report)
    print()
    print(output)

    print(f"\n[INFO] 详细报告已写入: {manager.report_file}")
    print(f"[INFO] 漂移状态已写入: {manager.state_file}")

    drifted = diff_results["summary"]["drifted_zones"]
    if drifted > 0:
        print(f"\n[RESULT] 检测到 {drifted} 个域名存在漂移。")
        return 2
    else:
        print("\n[RESULT] 所有域名均与基线一致。")
        return 0


def cmd_report(args: argparse.Namespace) -> int:
    import os
    if not os.path.exists(args.report_file):
        print(f"[ERROR] 报告文件不存在: {args.report_file}", file=sys.stderr)
        return 1
    import json
    with open(args.report_file, "r", encoding="utf-8") as f:
        report = json.load(f)
    print(ReportManager.render_console(report))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dns_audit.py",
        description="DNS 记录漂移巡检工具 —— 基线声明 vs 实际解析 差异比对",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_p = subparsers.add_parser("scan", help="执行一次 DNS 巡检扫描")
    scan_p.add_argument(
        "--baseline",
        required=True,
        help="YAML 基线声明文件路径 (例如 zones.yaml)",
    )
    scan_p.add_argument(
        "--resolver",
        default="8.8.8.8",
        help="DNS 解析服务器 IP (默认: 8.8.8.8)",
    )
    scan_p.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="单条查询超时秒数 (默认: 5.0)",
    )
    scan_p.add_argument(
        "--retries",
        type=int,
        default=2,
        help="失败重试次数 (默认: 2)",
    )
    scan_p.set_defaults(func=cmd_scan)

    report_p = subparsers.add_parser("report", help="渲染已有的报告 JSON 文件")
    report_p.add_argument(
        "--report-file",
        default="drift_report.json",
        help="报告 JSON 文件路径 (默认: drift_report.json)",
    )
    report_p.set_defaults(func=cmd_report)

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
