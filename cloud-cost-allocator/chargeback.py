#!/usr/bin/env python3
import os
import sys
import sqlite3
from datetime import datetime
from pathlib import Path

import click
import yaml

from src.database import Database
from src.importer import BillingImporter
from src.allocation_engine import AllocationEngine
from src.report_generator import ReportGenerator


def load_rules(rules_path: str) -> dict:
    with open(rules_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


@click.group()
def cli():
    pass


@cli.command()
@click.option("--billing", required=True, help="云厂商账单 CSV 文件路径")
@click.option("--rules", required=True, help="标签与分摊规则 YAML 文件路径")
@click.option("--db", default="chargeback.db", help="SQLite 数据库路径")
@click.option("--output", default="./reports", help="报表输出目录")
@click.option("--prev-billing", default=None, help="上月账单 CSV（用于环比计算）")
def run(billing, rules, db, output, prev_billing):
    """执行完整的账单分摊流程：导入 → 归属 → 分摊 → 出报表"""
    click.echo(f"[1/5] 加载规则文件: {rules}")
    rules_data = load_rules(rules)

    click.echo(f"[2/5] 初始化数据库: {db}")
    database = Database(db_path=db)
    database.init_schema()

    click.echo(f"[3/5] 导入账单 CSV: {billing}")
    importer = BillingImporter(database)
    current_month = importer.import_csv(billing)

    prev_month = None
    if prev_billing:
        click.echo(f"      同时导入上月账单: {prev_billing}")
        prev_month = importer.import_csv(prev_billing)

    click.echo("[4/5] 执行成本中心归属与分摊计算")
    engine = AllocationEngine(database, rules_data)
    engine.assign_cost_centers(current_month)
    engine.run_allocations(current_month)
    if prev_month:
        click.echo("      同时计算上月分摊数据...")
        engine.assign_cost_centers(prev_month)
        engine.run_allocations(prev_month)

    click.echo(f"[5/5] 生成月度报表 → {output}")
    os.makedirs(output, exist_ok=True)
    generator = ReportGenerator(database, output_dir=output, rules=rules_data)
    generator.generate_monthly_report(current_month, prev_month)

    click.echo("\n✅ 处理完成！")
    click.echo(f"   报告已输出至: {os.path.abspath(output)}")


@cli.command()
@click.option("--billing", required=True, help="云厂商账单 CSV 文件路径")
@click.option("--db", default="chargeback.db", help="SQLite 数据库路径")
def import_only(billing, db):
    """仅导入 CSV 到数据库（不做分摊和报表）"""
    database = Database(db_path=db)
    database.init_schema()
    importer = BillingImporter(database)
    month = importer.import_csv(billing)
    click.echo(f"✅ 导入完成，账单月份: {month}")


if __name__ == "__main__":
    cli()
