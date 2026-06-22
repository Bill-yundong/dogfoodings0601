import json

from src.allocation_engine import AllocationEngine


def _insert_records(db, records):
    sql = """
        INSERT INTO billing_records
        (billing_month, provider, service_name, resource_id, resource_name, tags, cost,
         currency, usage_quantity, usage_unit, region, raw_data, cost_center, assigned_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    rows = []
    for r in records:
        tags_json = json.dumps(r.get("tags", {}), ensure_ascii=False)
        raw_json = json.dumps(r, ensure_ascii=False)
        rows.append((
            r.get("billing_month", "2026-06"),
            r.get("provider", "aliyun"),
            r.get("service_name", "ecs"),
            r.get("resource_id"),
            r.get("resource_name"),
            tags_json,
            r.get("cost", 0.0),
            r.get("currency", "CNY"),
            r.get("usage_quantity"),
            r.get("usage_unit"),
            r.get("region"),
            raw_json,
            None,
            None,
        ))
    db.executemany(sql, rows)


class TestTagFallbackToNamingRule:
    def test_tag_not_in_map_falls_back_to_naming_pattern(self, db, sample_rules):
        records = [
            {
                "resource_id": "i-001",
                "resource_name": "order-app-01",
                "tags": {"Team": "team-unknown"},
                "cost": 100.0,
            },
        ]
        _insert_records(db, records)
        engine = AllocationEngine(db, sample_rules)
        engine.assign_cost_centers("2026-06")

        row = db.query_one("SELECT cost_center, assigned_by FROM billing_records WHERE resource_id = 'i-001'")
        assert row["cost_center"] == "订单中心"
        assert row["assigned_by"] == "name_pattern"

    def test_tag_in_map_wins_over_naming(self, db, sample_rules):
        records = [
            {
                "resource_id": "i-002",
                "resource_name": "order-app-02",
                "tags": {"CostCenter": "team-payment"},
                "cost": 100.0,
            },
        ]
        _insert_records(db, records)
        engine = AllocationEngine(db, sample_rules)
        engine.assign_cost_centers("2026-06")

        row = db.query_one("SELECT cost_center, assigned_by FROM billing_records WHERE resource_id = 'i-002'")
        assert row["cost_center"] == "支付团队"
        assert row["assigned_by"] == "tag"

    def test_both_tag_and_naming_miss_uses_default(self, db, sample_rules):
        records = [
            {
                "resource_id": "i-003",
                "resource_name": "random-machine",
                "tags": {"Env": "dev"},
                "cost": 50.0,
            },
        ]
        _insert_records(db, records)
        engine = AllocationEngine(db, sample_rules)
        engine.assign_cost_centers("2026-06")

        row = db.query_one("SELECT cost_center, assigned_by FROM billing_records WHERE resource_id = 'i-003'")
        assert row["cost_center"] == "Unallocated"
        assert row["assigned_by"] == "default"


class TestZeroWeightEqualDistribution:
    def test_all_zero_weights_falls_back_to_equal_split(self, db, sample_rules):
        rules = dict(sample_rules)
        rules["shared_allocations"] = [{
            "name": "按资源数分摊（零权重）",
            "source_cost_center": "共享服务",
            "weight_by": "resource_count",
            "target_cost_centers": ["A", "B", "C"],
        }]
        records = [
            {"resource_id": "gw-1", "resource_name": "common-gateway-1",
             "tags": {"Team": "team-missing"}, "cost": 300.0},
        ]
        _insert_records(db, records)
        engine = AllocationEngine(db, rules)
        engine.assign_cost_centers("2026-06")
        engine.run_allocations("2026-06")

        row = db.query_one("SELECT cost_center FROM billing_records WHERE resource_id = 'gw-1'")
        assert row["cost_center"] == "共享服务"

        rows = db.query(
            "SELECT target_cost_center, SUM(allocated_cost) as amt FROM allocation_records GROUP BY target_cost_center"
        )
        amts = {r["target_cost_center"]: r["amt"] for r in rows}
        for cc in ["A", "B", "C"]:
            assert abs(amts.get(cc, 0.0) - 100.0) < 0.01

    def test_equal_weight_explicit(self, db, sample_rules):
        rules = dict(sample_rules)
        rules["shared_allocations"] = [{
            "name": "均分",
            "source_cost_center": "共享服务",
            "weight_by": "equal",
            "target_cost_centers": ["订单中心", "支付团队"],
        }]
        records = [
            {"resource_id": "gw-2", "resource_name": "common-gateway-2",
             "tags": {"Team": "team-missing"}, "cost": 200.0},
        ]
        _insert_records(db, records)
        engine = AllocationEngine(db, rules)
        engine.assign_cost_centers("2026-06")
        engine.run_allocations("2026-06")

        row = db.query_one("SELECT cost_center FROM billing_records WHERE resource_id = 'gw-2'")
        assert row["cost_center"] == "共享服务"

        rows = db.query(
            "SELECT target_cost_center, SUM(allocated_cost) as amt FROM allocation_records GROUP BY target_cost_center"
        )
        amts = {r["target_cost_center"]: r["amt"] for r in rows}
        assert abs(amts["订单中心"] - 100.0) < 0.01
        assert abs(amts["支付团队"] - 100.0) < 0.01


class TestDeduplicateAcrossRules:
    def test_same_source_not_allocated_twice(self, db, sample_rules):
        records = [
            {"resource_id": "gw-main", "resource_name": "common-gateway-main",
             "tags": {}, "cost": 400.0},
            {"resource_id": "i-order", "resource_name": "order-app-1",
             "tags": {"CostCenter": "team-order"}, "cost": 100.0},
            {"resource_id": "i-pay", "resource_name": "pay-app-1",
             "tags": {"CostCenter": "team-payment"}, "cost": 100.0},
            {"resource_id": "i-user", "resource_name": "user-app-1",
             "tags": {"CostCenter": "team-user"}, "cost": 100.0},
            {"resource_id": "i-data", "resource_name": "data-app-1",
             "tags": {"CostCenter": "team-data"}, "cost": 100.0},
        ]
        _insert_records(db, records)
        engine = AllocationEngine(db, sample_rules)
        engine.assign_cost_centers("2026-06")
        engine.run_allocations("2026-06")

        total_alloc = db.query_one("SELECT SUM(allocated_cost) as total FROM allocation_records")["total"]
        assert abs(total_alloc - 400.0) < 0.01

        src_ids = db.query("SELECT DISTINCT source_record_id FROM allocation_records")
        assert len(src_ids) == 1
