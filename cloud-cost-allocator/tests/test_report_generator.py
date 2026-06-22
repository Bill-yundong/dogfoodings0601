import csv
import json
import os

from src.report_generator import ReportGenerator


class TestMoMCalculation:
    def test_previous_zero_returns_na(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        rate, text = gen._calc_mom(100.0, 0.0)
        assert rate is None
        assert text == "N/A"

    def test_previous_none_returns_na(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        rate, text = gen._calc_mom(100.0, None)
        assert rate is None
        assert text == "N/A"

    def test_positive_mom(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        rate, text = gen._calc_mom(150.0, 100.0)
        assert rate == 50.0
        assert "↑" in text
        assert "+50.00%" in text

    def test_negative_mom(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        rate, text = gen._calc_mom(80.0, 100.0)
        assert rate == -20.0
        assert "↓" in text
        assert "-20.00%" in text

    def test_zero_change_mom(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        rate, text = gen._calc_mom(100.0, 100.0)
        assert rate == 0.0
        assert "→" in text
        assert "+0.00%" in text


class TestBudgetAlertThresholds:
    def test_below_80_no_alert(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        summary = {"用户中心": {"total_cost": 300.0}}
        alerts = gen._calc_budget_alerts(summary)
        assert len(alerts) == 0

    def test_at_80_yellow_alert(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        summary = {"用户中心": {"total_cost": 400.0}}
        alerts = gen._calc_budget_alerts(summary)
        assert len(alerts) == 1
        assert alerts[0]["level"] == "YELLOW"
        assert alerts[0]["ratio"] == 80.0

    def test_between_80_and_100_yellow(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        summary = {"支付团队": {"total_cost": 720.0}}
        alerts = gen._calc_budget_alerts(summary)
        assert len(alerts) == 1
        assert alerts[0]["level"] == "YELLOW"

    def test_at_100_red_alert(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        summary = {"支付团队": {"total_cost": 800.0}}
        alerts = gen._calc_budget_alerts(summary)
        assert len(alerts) == 1
        assert alerts[0]["level"] == "RED"
        assert alerts[0]["ratio"] == 100.0

    def test_above_100_red_alert(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        summary = {"订单中心": {"total_cost": 1500.0}}
        alerts = gen._calc_budget_alerts(summary)
        assert alerts[0]["level"] == "RED"
        assert alerts[0]["diff"] == 500.0

    def test_no_budget_config_skip(self, db, sample_rules):
        gen = ReportGenerator(db, rules=sample_rules)
        summary = {"UnknownCC": {"total_cost": 99999.0}}
        alerts = gen._calc_budget_alerts(summary)
        assert len(alerts) == 0


class TestTagCoverageEmpty:
    def test_no_unallocated_resources(self, db, sample_rules, tmp_path):
        db.execute(
            """INSERT INTO billing_records
            (billing_month, provider, service_name, resource_id, resource_name, tags, cost,
             currency, usage_quantity, usage_unit, region, raw_data, cost_center, assigned_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("2026-06", "aliyun", "ecs", "i-ok", "order-app-1",
             json.dumps({"CostCenter": "team-order"}), 100.0,
             "CNY", 720, "小时", "cn-hangzhou", "{}", "订单中心", "tag"),
        )
        gen = ReportGenerator(db, output_dir=str(tmp_path), rules=sample_rules)
        coverage = gen._generate_tag_coverage_report("2026-06", 100.0)

        assert coverage["untagged_count"] == 0
        assert coverage["untagged_cost"] == 0.0
        assert coverage["cost_percentage"] == 0.0
        assert coverage["by_service"] == {}

        csv_path = tmp_path / "tag-coverage-2026-06.csv"
        assert csv_path.exists()

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            lines = list(reader)

        has_detail = any("Unallocated 资源明细" in str(row) for row in lines)
        assert has_detail

    def test_some_unallocated_resources(self, db, sample_rules, tmp_path):
        sql = """
            INSERT INTO billing_records
            (billing_month, provider, service_name, resource_id, resource_name, tags, cost,
             currency, usage_quantity, usage_unit, region, raw_data, cost_center, assigned_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        db.executemany(sql, [
            ("2026-06", "aliyun", "ecs", "i-u1", "unknown-1", "{}", 100.0,
             "CNY", 720, "小时", "cn-hangzhou", "{}", "Unallocated", "default"),
            ("2026-06", "aliyun", "oss", "oss-u1", "random-backup", '{"Project":"unknown"}',
             50.0, "CNY", 100, "GB", "cn-hangzhou", "{}", "Unallocated", "default"),
            ("2026-06", "aliyun", "ecs", "i-t1", "order-app-1", "{}", 200.0,
             "CNY", 720, "小时", "cn-hangzhou", "{}", "订单中心", "tag"),
        ])
        gen = ReportGenerator(db, output_dir=str(tmp_path), rules=sample_rules)
        coverage = gen._generate_tag_coverage_report("2026-06", 350.0)

        assert coverage["untagged_count"] == 2
        assert coverage["untagged_cost"] == 150.0
        assert abs(coverage["cost_percentage"] - (150.0 / 350.0 * 100)) < 0.01
        assert "ecs" in coverage["by_service"]
        assert coverage["by_service"]["ecs"]["count"] == 1
        assert coverage["by_service"]["oss"]["count"] == 1
