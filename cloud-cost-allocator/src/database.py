import sqlite3
from contextlib import contextmanager
from typing import List, Tuple, Any, Optional


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS billing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billing_month TEXT NOT NULL,
    provider TEXT,
    service_name TEXT,
    resource_id TEXT,
    resource_name TEXT,
    tags TEXT,
    cost REAL NOT NULL DEFAULT 0.0,
    currency TEXT DEFAULT 'CNY',
    usage_quantity REAL,
    usage_unit TEXT,
    region TEXT,
    raw_data TEXT,
    cost_center TEXT,
    assigned_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_month ON billing_records(billing_month);
CREATE INDEX IF NOT EXISTS idx_cost_center ON billing_records(cost_center);
CREATE INDEX IF NOT EXISTS idx_resource_id ON billing_records(resource_id);

CREATE TABLE IF NOT EXISTS allocation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billing_month TEXT NOT NULL,
    source_record_id INTEGER NOT NULL,
    source_cost_center TEXT,
    target_cost_center TEXT NOT NULL,
    allocated_cost REAL NOT NULL,
    allocation_ratio REAL NOT NULL,
    allocation_rule TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_record_id) REFERENCES billing_records(id)
);

CREATE INDEX IF NOT EXISTS idx_alloc_month ON allocation_records(billing_month);
CREATE INDEX IF NOT EXISTS idx_alloc_target ON allocation_records(target_cost_center);

CREATE TABLE IF NOT EXISTS monthly_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billing_month TEXT NOT NULL,
    cost_center TEXT NOT NULL,
    total_cost REAL NOT NULL DEFAULT 0.0,
    direct_cost REAL NOT NULL DEFAULT 0.0,
    allocated_in_cost REAL NOT NULL DEFAULT 0.0,
    allocated_out_cost REAL NOT NULL DEFAULT 0.0,
    record_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(billing_month, cost_center)
);
"""


class Database:
    def __init__(self, db_path: str = "chargeback.db"):
        self.db_path = db_path

    @contextmanager
    def get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_schema(self) -> None:
        with self.get_conn() as conn:
            conn.executescript(SCHEMA_SQL)

    def execute(self, sql: str, params: Tuple = ()) -> int:
        with self.get_conn() as conn:
            cursor = conn.execute(sql, params)
            return cursor.lastrowid

    def executemany(self, sql: str, params_list: List[Tuple]) -> None:
        with self.get_conn() as conn:
            conn.executemany(sql, params_list)

    def query(self, sql: str, params: Tuple = ()) -> List[sqlite3.Row]:
        with self.get_conn() as conn:
            cursor = conn.execute(sql, params)
            return cursor.fetchall()

    def query_one(self, sql: str, params: Tuple = ()) -> Optional[sqlite3.Row]:
        with self.get_conn() as conn:
            cursor = conn.execute(sql, params)
            return cursor.fetchone()

    def clear_month(self, billing_month: str) -> None:
        with self.get_conn() as conn:
            conn.execute("DELETE FROM allocation_records WHERE billing_month = ?", (billing_month,))
            conn.execute("DELETE FROM monthly_summary WHERE billing_month = ?", (billing_month,))
            conn.execute("DELETE FROM billing_records WHERE billing_month = ?", (billing_month,))
