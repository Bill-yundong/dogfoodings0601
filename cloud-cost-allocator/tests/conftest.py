import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from src.database import Database


SAMPLE_RULES = {
    "default_cost_center": "Unallocated",
    "cost_center_tags": ["CostCenter", "Team"],
    "tag_value_map": {
        "team-order": "订单中心",
        "team-payment": "支付团队",
        "team-user": "用户中心",
        "team-data": "数据平台",
    },
    "naming_rules": [
        {"pattern": "^order-", "cost_center": "订单中心"},
        {"pattern": "^pay-", "cost_center": "支付团队"},
        {"pattern": "^common-gateway", "cost_center": "共享服务"},
    ],
    "shared_allocations": [
        {
            "name": "网关分摊",
            "source_resource_pattern": "^common-gateway",
            "weight_by": "resource_count",
            "target_cost_centers": ["订单中心", "支付团队", "用户中心", "数据平台"],
        },
        {
            "name": "共享服务分摊",
            "source_cost_center": "共享服务",
            "weight_by": "equal",
            "target_cost_centers": ["订单中心", "支付团队", "用户中心", "数据平台"],
        },
    ],
    "budgets": {
        "订单中心": 1000,
        "支付团队": 800,
        "用户中心": 500,
        "数据平台": 2000,
        "共享服务": 500,
        "Unallocated": 100,
    },
}


@pytest.fixture
def db(tmp_path):
    db_path = tmp_path / "test.db"
    database = Database(db_path=str(db_path))
    database.init_schema()
    return database


@pytest.fixture
def sample_rules():
    return dict(SAMPLE_RULES)
