#!/usr/bin/env python3
"""数据脱敏管道 CLI 入口。

用法:
  python mask.py run --source raw.db --target masked.db --rules rules.yaml
  python mask.py scan --source raw.db --rules rules.yaml
  python mask.py init --source raw.db            # 生成示例源库
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

from config import load_rules
from consistency import ConsistencyMap
from masking import MaskingEngine
from scanner import Scanner
from validator import Validator

DEFAULT_RULES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules.yaml")


def cmd_run(args) -> int:
    print("=" * 72)
    print(" 数据脱敏管道 - 运行 (run)")
    print("=" * 72)
    print(f" 源库   : {args.source}")
    print(f" 目标库 : {args.target}")
    print(f" 规则   : {args.rules}")
    print("-" * 72)

    if not os.path.exists(args.source):
        print(f"[错误] 源库不存在: {args.source}", file=sys.stderr)
        return 1
    rules = load_rules(args.rules)

    # 1. 扫描敏感字段
    print("[1/3] 扫描源库, 自动识别敏感字段 ...")
    t0 = time.time()
    scan = Scanner(args.source, rules).scan()
    scan_time = time.time() - t0
    print_scan_summary(scan, scan_time)

    # 2. 脱敏写入目标库
    print("[2/3] 脱敏引擎处理并写入目标库 ...")
    t1 = time.time()
    with ConsistencyMap(args.consistency_map) as cmap:
        engine = MaskingEngine(rules, cmap)
        stats = engine.run(args.source, args.target, scan)
        mask_time = time.time() - t1
        print_masking_stats(stats, mask_time)
        cmap_path = args.consistency_map

    # 3. 校验
    print("[3/3] 校验脱敏前后数据一致性 ...")
    t2 = time.time()
    report = Validator(args.source, args.target, rules).validate(scan)
    valid_time = time.time() - t2
    print_validation_report(report, valid_time, cmap_path)

    print("=" * 72)
    print(f" 脱敏完成。结果: {'通过 ✓' if report.passed else '存在异常 ✗'}")
    print(f" 脱敏库   : {os.path.abspath(args.target)}")
    print(f" 映射表   : {os.path.abspath(cmap_path)}")
    print("=" * 72)
    return 0 if report.passed else 2


def cmd_scan(args) -> int:
    if not os.path.exists(args.source):
        print(f"[错误] 源库不存在: {args.source}", file=sys.stderr)
        return 1
    rules = load_rules(args.rules)
    scan = Scanner(args.source, rules).scan()
    print_scan_summary(scan, 0.0)
    print("\n敏感字段明细:")
    for sf in scan.fields:
        ratio = f"{sf.match_ratio:.0%}" if sf.reason == "regex_pattern" else "100%"
        print(f"  - {sf.table}.{sf.column}  -> {sf.field_type}  "
              f"[{sf.reason}, {ratio}]")
    return 0


def cmd_init(args) -> int:
    from setup_db import build_sample_db
    build_sample_db(args.source)
    print(f"已生成示例源库: {os.path.abspath(args.source)}")
    return 0


def print_scan_summary(scan, elapsed) -> None:
    print(f"  扫描表数   : {scan.tables_scanned}")
    print(f"  扫描列数   : {scan.columns_scanned}")
    by_type = {}
    for sf in scan.fields:
        by_type[sf.field_type] = by_type.get(sf.field_type, 0) + 1
    print(f"  识别敏感字段: {len(scan.fields)} 个")
    for ft, n in sorted(by_type.items()):
        print(f"     - {ft:10s}: {n}")
    print(f"  耗时       : {elapsed:.3f}s")
    print()


def print_masking_stats(stats, elapsed) -> None:
    d = stats.as_dict()
    print(f"  处理表数   : {d['tables_processed']}")
    print(f"  处理行数   : {d['rows_processed']}")
    print(f"  脱敏列数   : {d['columns_masked']}")
    print(f"  脱敏值总数 : {d['values_masked_total']}")
    print(f"  各类型脱敏值:")
    for ft, n in sorted(d["values_masked_by_type"].items()):
        print(f"     - {ft:10s}: {n}")
    print(f"  一致性映射条目: {d['consistency_entries']}")
    print(f"  耗时       : {elapsed:.3f}s")
    print()


def print_validation_report(report, elapsed, cmap_path) -> None:
    print(f"  校验结果   : {'通过 ✓' if report.passed else '存在异常 ✗'}")
    print(f"  表级明细:")
    for tv in report.tables:
        flag = "OK " if tv.passed else "!! "
        print(f"     {flag}{tv.table}")
        print(f"         行数 源/目标: {tv.source_rows}/{tv.target_rows} "
              f"({'一致' if tv.row_count_match else '不一致'})")
        print(f"         非敏感字段不一致行数: {tv.non_sensitive_mismatches}")
        print(f"         疑似未脱敏敏感值   : {tv.sensitive_leaks}")
        for note in tv.notes:
            print(f"         备注: {note}")
    print(f"  合计不一致行数: {report.total_mismatches}")
    print(f"  合计疑似漏脱  : {report.total_leaks}")
    print(f"  耗时       : {elapsed:.3f}s")
    print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mask.py",
        description="数据脱敏管道: 自动识别敏感字段 -> 脱敏 -> 校验",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="扫描+脱敏+校验 一站式运行")
    p_run.add_argument("--source", required=True, help="源 SQLite 数据库路径")
    p_run.add_argument("--target", required=True, help="脱敏后目标库路径")
    p_run.add_argument("--rules", default=DEFAULT_RULES, help="规则文件 rules.yaml")
    p_run.add_argument("--consistency-map", default="consistency_map.db",
                       help="一致性映射表库路径")
    p_run.set_defaults(func=cmd_run)

    p_scan = sub.add_parser("scan", help="仅扫描并打印敏感字段识别结果")
    p_scan.add_argument("--source", required=True, help="源 SQLite 数据库路径")
    p_scan.add_argument("--rules", default=DEFAULT_RULES, help="规则文件 rules.yaml")
    p_scan.set_defaults(func=cmd_scan)

    p_init = sub.add_parser("init", help="生成示例源库用于演示")
    p_init.add_argument("--source", default="raw.db", help="生成的源库路径")
    p_init.set_defaults(func=cmd_init)

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
