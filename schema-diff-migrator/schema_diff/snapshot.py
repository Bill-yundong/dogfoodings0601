import os
import sqlite3
from datetime import datetime, timezone


class Snapshot:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.version = "1.0"
        self.tables = {}
        self.indices = {}

    def take(self) -> dict:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            self._extract_tables(cursor)
            self._extract_indices(cursor)
        finally:
            conn.close()

        return {
            "version": self.version,
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "database": os.path.basename(self.db_path),
            "tables": self.tables,
            "indices": self.indices,
        }

    def _extract_tables(self, cursor: sqlite3.Cursor) -> None:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        table_names = [row["name"] for row in cursor.fetchall()]

        for table_name in table_names:
            self.tables[table_name] = self._extract_table(cursor, table_name)

    def _extract_table(self, cursor: sqlite3.Cursor, table_name: str) -> dict:
        cursor.execute(f"PRAGMA table_info('{table_name}')")
        columns = {}
        primary_keys = []

        for row in cursor.fetchall():
            col = {
                "name": row["name"],
                "type": row["type"],
                "notnull": bool(row["notnull"]),
                "default": row["dflt_value"],
                "pk": bool(row["pk"]),
            }
            columns[row["name"]] = col
            if col["pk"]:
                primary_keys.append(row["name"])

        cursor.execute(f"PRAGMA foreign_key_list('{table_name}')")
        foreign_keys = []
        for row in cursor.fetchall():
            fk = {
                "id": row["id"],
                "seq": row["seq"],
                "table": row["table"],
                "from": row["from"],
                "to": row["to"],
                "on_update": row["on_update"],
                "on_delete": row["on_delete"],
                "match": row["match"],
            }
            foreign_keys.append(fk)

        cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'")
        create_sql_row = cursor.fetchone()
        create_sql = create_sql_row["sql"] if create_sql_row else None

        unique_constraints = self._extract_unique_constraints(cursor, table_name)

        return {
            "columns": columns,
            "primary_keys": primary_keys,
            "foreign_keys": foreign_keys,
            "unique_constraints": unique_constraints,
            "create_sql": create_sql,
        }

    def _extract_unique_constraints(self, cursor: sqlite3.Cursor, table_name: str) -> list:
        cursor.execute(
            "SELECT name, sql FROM sqlite_master "
            "WHERE type='index' AND tbl_name=? AND sql IS NOT NULL AND sql LIKE '%UNIQUE%'",
            (table_name,),
        )
        constraints = []
        for row in cursor.fetchall():
            sql = row["sql"]
            idx_name = row["name"]
            cols = self._parse_index_columns(sql)
            constraints.append({"name": idx_name, "columns": cols})
        return constraints

    def _parse_index_columns(self, sql: str) -> list:
        try:
            inner = sql[sql.index("(") + 1 : sql.rindex(")")]
            cols = [c.strip().strip('"').strip("`") for c in inner.split(",")]
            return cols
        except (ValueError, IndexError):
            return []

    def _extract_indices(self, cursor: sqlite3.Cursor) -> None:
        cursor.execute(
            "SELECT name, tbl_name, sql FROM sqlite_master "
            "WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name"
        )
        for row in cursor.fetchall():
            sql = row["sql"]
            is_unique = "UNIQUE" in sql.upper()
            columns = self._parse_index_columns(sql)
            self.indices[row["name"]] = {
                "name": row["name"],
                "table": row["tbl_name"],
                "columns": columns,
                "unique": is_unique,
                "create_sql": sql,
            }
