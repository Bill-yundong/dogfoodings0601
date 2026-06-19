"""Load layer: writes transformed rows into the target SQLite table.

The loader is deliberately transactional:

* It first creates / verifies the schema for the target table and the
  quarantine table.
* All rows are inserted inside a single explicit transaction, then the
  quarantine rows are inserted in the same transaction.
* If anything fails during the load, the caller simply rolls back -- we
  never leave the target DB half-populated.

The loader uses :class:`sqlite3.Cursor.executemany` for bulk inserts, which
has order-of-magnitude better throughput than single-row inserts while still
allowing per-row type translation through Python.
"""

from __future__ import annotations

import os
import sqlite3
from typing import Iterable, List, Sequence

from .config import PRIMARY_KEY, TARGET_COLUMNS, TARGET_TABLE
from .quarantine import QuarantineStore
from .transformer import TransformSuccess


def build_schema_sql() -> str:
    """Return the DDL for the target table, built from :mod:`etl_pipeline.config`."""
    cols = [f"    {name} {sqlite_type}" for name, sqlite_type, _py in TARGET_COLUMNS]
    cols.append(f"    PRIMARY KEY ({PRIMARY_KEY})")
    return f"CREATE TABLE IF NOT EXISTS {TARGET_TABLE} (\n" + ",\n".join(cols) + "\n)"


def init_db(db_path: str) -> sqlite3.Connection:
    """Open (or create) the target database and ensure both tables exist."""
    parent = os.path.dirname(os.path.abspath(db_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute(build_schema_sql())
    QuarantineStore(conn).init()
    conn.commit()
    return conn


def upsert_sql() -> str:
    """Build the parameterised INSERT ... ON CONFLICT DO UPDATE statement.

    The conflict target is the PRIMARY KEY declared in config.  On conflict we
    update every non-PK column.  This allows repeated runs to refresh rows
    instead of blowing up.
    """
    cols = [name for name, _type, _py in TARGET_COLUMNS]
    placeholders = ", ".join("?" for _ in cols)
    non_pk = [c for c in cols if c != PRIMARY_KEY]
    updates = ", ".join(f"{c} = excluded.{c}" for c in non_pk)
    return (
        f"INSERT INTO {TARGET_TABLE} ({', '.join(cols)}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT ({PRIMARY_KEY}) DO UPDATE SET {updates}"
    )


def load_rows(conn: sqlite3.Connection, rows: Iterable[TransformSuccess]) -> int:
    """Insert a batch of transformed rows, returning the number written.

    The caller is responsible for ``BEGIN`` / ``COMMIT`` / ``ROLLBACK``; this
    function intentionally does not touch the transaction boundary so a
    higher-level orchestrator can group quarantine writes together with data
    writes into one atomic commit.
    """
    ordered_cols = [name for name, _type, _py in TARGET_COLUMNS]
    params: List[Sequence[object]] = []
    for row in rows:
        rec = row.values
        params.append(tuple(rec.get(col) for col in ordered_cols))

    if not params:
        return 0

    conn.executemany(upsert_sql(), params)
    return len(params)


def count_target_rows(conn: sqlite3.Connection) -> int:
    cur = conn.execute(f"SELECT COUNT(*) FROM {TARGET_TABLE}")
    return cur.fetchone()[0]
