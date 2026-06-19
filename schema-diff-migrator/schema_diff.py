import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from typing import Any


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


class Differ:
    def __init__(self, old_snapshot: dict, new_snapshot: dict):
        self.old = old_snapshot
        self.new = new_snapshot

    def diff(self) -> dict:
        return {
            "tables": self._diff_tables(),
            "indices": self._diff_indices(),
        }

    def _diff_tables(self) -> dict:
        old_tables = set(self.old.get("tables", {}).keys())
        new_tables = set(self.new.get("tables", {}).keys())

        added = new_tables - old_tables
        removed = old_tables - new_tables
        common = old_tables & new_tables

        modified = {}
        for table in common:
            table_diff = self._diff_table(table)
            if table_diff:
                modified[table] = table_diff

        return {
            "added": {t: self.new["tables"][t] for t in added},
            "removed": {t: self.old["tables"][t] for t in removed},
            "modified": modified,
        }

    def _diff_table(self, table_name: str) -> dict:
        old_table = self.old["tables"][table_name]
        new_table = self.new["tables"][table_name]

        old_cols = set(old_table["columns"].keys())
        new_cols = set(new_table["columns"].keys())

        added_cols = new_cols - old_cols
        removed_cols = old_cols - new_cols
        common_cols = old_cols & new_cols

        modified_cols = {}
        for col in common_cols:
            col_diff = self._diff_column(old_table["columns"][col], new_table["columns"][col])
            if col_diff:
                modified_cols[col] = col_diff

        pk_diff = self._diff_primary_keys(old_table.get("primary_keys", []), new_table.get("primary_keys", []))
        fk_diff = self._diff_foreign_keys(old_table.get("foreign_keys", []), new_table.get("foreign_keys", []))
        unique_diff = self._diff_unique_constraints(
            old_table.get("unique_constraints", []), new_table.get("unique_constraints", [])
        )

        result = {}
        if added_cols:
            result["added_columns"] = {c: new_table["columns"][c] for c in added_cols}
        if removed_cols:
            result["removed_columns"] = {c: old_table["columns"][c] for c in removed_cols}
        if modified_cols:
            result["modified_columns"] = modified_cols
        if pk_diff:
            result["primary_keys"] = pk_diff
        if fk_diff:
            result["foreign_keys"] = fk_diff
        if unique_diff:
            result["unique_constraints"] = unique_diff

        return result

    def _diff_column(self, old_col: dict, new_col: dict) -> dict:
        changes = {}
        for field in ["type", "notnull", "default", "pk"]:
            if old_col.get(field) != new_col.get(field):
                changes[field] = {"old": old_col.get(field), "new": new_col.get(field)}
        return changes

    def _diff_primary_keys(self, old_pk: list, new_pk: list) -> dict:
        if old_pk == new_pk:
            return {}
        return {"old": old_pk, "new": new_pk}

    def _diff_foreign_keys(self, old_fks: list, new_fks: list) -> dict:
        old_keys = self._normalize_fks(old_fks)
        new_keys = self._normalize_fks(new_fks)
        if old_keys == new_keys:
            return {}
        return {"old": old_keys, "new": new_keys}

    def _normalize_fks(self, fks: list) -> list:
        normalized = []
        fk_groups = {}
        for fk in fks:
            key = (fk["id"], fk["table"])
            if key not in fk_groups:
                fk_groups[key] = {
                    "table": fk["table"],
                    "columns": [],
                    "ref_columns": [],
                    "on_update": fk.get("on_update"),
                    "on_delete": fk.get("on_delete"),
                }
            fk_groups[key]["columns"].append(fk["from"])
            fk_groups[key]["ref_columns"].append(fk["to"])
        for key in sorted(fk_groups.keys()):
            normalized.append(fk_groups[key])
        return normalized

    def _diff_unique_constraints(self, old_uqs: list, new_uqs: list) -> dict:
        def _key(uq):
            return tuple(sorted(uq.get("columns", [])))

        old_keys = {_key(u): u for u in old_uqs}
        new_keys = {_key(u): u for u in new_uqs}

        added = {k: v for k, v in new_keys.items() if k not in old_keys}
        removed = {k: v for k, v in old_keys.items() if k not in new_keys}

        if not added and not removed:
            return {}
        return {"added": list(added.values()), "removed": list(removed.values())}

    def _diff_indices(self) -> dict:
        old_indices = set(self.old.get("indices", {}).keys())
        new_indices = set(self.new.get("indices", {}).keys())

        added = new_indices - old_indices
        removed = old_indices - new_indices

        modified = {}
        for idx in old_indices & new_indices:
            old_idx = self.old["indices"][idx]
            new_idx = self.new["indices"][idx]
            if self._index_diff(old_idx, new_idx):
                modified[idx] = {"old": old_idx, "new": new_idx}

        return {
            "added": {i: self.new["indices"][i] for i in added},
            "removed": {i: self.old["indices"][i] for i in removed},
            "modified": modified,
        }

    def _index_diff(self, old_idx: dict, new_idx: dict) -> bool:
        return (
            old_idx.get("table") != new_idx.get("table")
            or sorted(old_idx.get("columns", [])) != sorted(new_idx.get("columns", []))
            or old_idx.get("unique") != new_idx.get("unique")
        )


class MigrationGenerator:
    def __init__(self, diff_result: dict):
        self.diff = diff_result
        self.statements = []

    def generate(self) -> list:
        self.statements = []
        self._generate_table_ddl()
        self._generate_index_ddl()
        return self.statements

    def _generate_table_ddl(self) -> None:
        tables = self.diff.get("tables", {})

        added = tables.get("added", {})
        for table_name in self._topo_sort_tables(added):
            self.statements.append(self._build_create_table(table_name, added[table_name]))

        for table_name, table_def in tables.get("removed", {}).items():
            self.statements.append(f"DROP TABLE IF EXISTS {self._quote(table_name)};")

        for table_name, changes in tables.get("modified", {}).items():
            self._generate_table_modifications(table_name, changes)

    def _topo_sort_tables(self, added_tables: dict) -> list:
        names = list(added_tables.keys())
        in_degree = {n: 0 for n in names}
        edges = {n: [] for n in names}
        name_set = set(names)

        for name, tdef in added_tables.items():
            for fk in self._normalize_fks(tdef.get("foreign_keys", [])):
                ref = fk["table"]
                if ref in name_set and ref != name:
                    edges[ref].append(name)
                    in_degree[name] += 1

        result = []
        queue = [n for n, d in in_degree.items() if d == 0]
        queue.sort()
        while queue:
            n = queue.pop(0)
            result.append(n)
            for m in sorted(edges[n]):
                in_degree[m] -= 1
                if in_degree[m] == 0:
                    queue.append(m)
                    queue.sort()

        if len(result) != len(names):
            result.extend(sorted(n for n in names if n not in result))
        return result

    def _build_create_table(self, table_name: str, table_def: dict) -> str:
        if table_def.get("create_sql"):
            return table_def["create_sql"] + ";"

        column_defs = []
        for col_name, col in table_def["columns"].items():
            col_def = [self._quote(col_name), col["type"] or "TEXT"]
            if col.get("notnull"):
                col_def.append("NOT NULL")
            if col.get("default") is not None:
                col_def.append(f"DEFAULT {col['default']}")
            column_defs.append(" ".join(col_def))

        pk = table_def.get("primary_keys", [])
        if pk and len(pk) == 1 and not any(
            c["name"] == pk[0] and c.get("pk") for c in table_def["columns"].values()
        ):
            column_defs.append(f"PRIMARY KEY ({', '.join(self._quote(c) for c in pk)})")
        elif len(pk) > 1:
            column_defs.append(f"PRIMARY KEY ({', '.join(self._quote(c) for c in pk)})")

        for fk in self._normalize_fks(table_def.get("foreign_keys", [])):
            column_defs.append(
                f"FOREIGN KEY ({', '.join(self._quote(c) for c in fk['columns'])}) "
                f"REFERENCES {self._quote(fk['table'])} ({', '.join(self._quote(c) for c in fk['ref_columns'])})"
            )

        for uq in table_def.get("unique_constraints", []):
            column_defs.append(f"UNIQUE ({', '.join(self._quote(c) for c in uq['columns'])})")

        return (
            f"CREATE TABLE {self._quote(table_name)} "
            f"({', '.join(column_defs)});"
        )

    def _normalize_fks(self, fks: list) -> list:
        if not fks:
            return []
        normalized = []
        for fk in fks:
            if "columns" in fk:
                normalized.append(fk)
            else:
                key = (fk["id"], fk["table"])
                found = False
                for existing in normalized:
                    if existing["table"] == fk["table"]:
                        existing["columns"].append(fk["from"])
                        existing["ref_columns"].append(fk["to"])
                        found = True
                        break
                if not found:
                    normalized.append({
                        "table": fk["table"],
                        "columns": [fk["from"]],
                        "ref_columns": [fk["to"]],
                        "on_update": fk.get("on_update"),
                        "on_delete": fk.get("on_delete"),
                    })
        return normalized

    def _generate_table_modifications(self, table_name: str, changes: dict) -> None:
        if "added_columns" in changes:
            for col_name, col in changes["added_columns"].items():
                self.statements.append(self._build_add_column(table_name, col))

        if "removed_columns" in changes:
            for col_name in changes["removed_columns"]:
                self.statements.append(
                    f"ALTER TABLE {self._quote(table_name)} DROP COLUMN {self._quote(col_name)};"
                )

        if "modified_columns" in changes or "primary_keys" in changes:
            self.statements.append(
                f"-- Warning: Column modifications or primary key changes on table {table_name} "
                f"require table recreation in SQLite"
            )

    def _build_add_column(self, table_name: str, col: dict) -> str:
        parts = [
            f"ALTER TABLE {self._quote(table_name)} ADD COLUMN {self._quote(col['name'])}",
            col["type"] or "TEXT",
        ]
        if col.get("notnull"):
            if col.get("default") is None:
                parts.append("DEFAULT ''")
            parts.append("NOT NULL")
        if col.get("default") is not None:
            parts.append(f"DEFAULT {col['default']}")
        return " ".join(parts) + ";"

    def _generate_index_ddl(self) -> None:
        indices = self.diff.get("indices", {})

        for idx_name, idx in indices.get("removed", {}).items():
            self.statements.append(f"DROP INDEX IF EXISTS {self._quote(idx_name)};")

        for idx_name, idx in indices.get("modified", {}).items():
            self.statements.append(f"DROP INDEX IF EXISTS {self._quote(idx_name)};")

        for idx_name, idx in list(indices.get("added", {}).items()) + [
            (k, v["new"]) for k, v in indices.get("modified", {}).items()
        ]:
            if idx.get("create_sql"):
                self.statements.append(idx["create_sql"] + ";")
            else:
                unique = "UNIQUE " if idx.get("unique") else ""
                cols = ", ".join(self._quote(c) for c in idx.get("columns", []))
                self.statements.append(
                    f"CREATE {unique}INDEX {self._quote(idx_name)} "
                    f"ON {self._quote(idx['table'])} ({cols});"
                )

    def _quote(self, identifier: str) -> str:
        return f'"{identifier}"'


def cmd_snapshot(args: argparse.Namespace) -> int:
    if not os.path.isfile(args.db_path):
        print(f"Error: Database file not found: {args.db_path}", file=sys.stderr)
        return 1

    snapshot = Snapshot(args.db_path)
    data = snapshot.take()

    if args.output:
        out_path = args.output
    else:
        base = os.path.splitext(os.path.basename(args.db_path))[0]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = f"{base}_snapshot_{timestamp}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Snapshot saved to: {out_path}")
    print(f"  Tables: {len(data['tables'])}")
    print(f"  Indices: {len(data['indices'])}")
    return 0


def cmd_migrate(args: argparse.Namespace) -> int:
    for path in [args.old_snapshot, args.new_snapshot]:
        if not os.path.isfile(path):
            print(f"Error: File not found: {path}", file=sys.stderr)
            return 1

    with open(args.old_snapshot, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(args.new_snapshot, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    differ = Differ(old_data, new_data)
    diff_result = differ.diff()

    generator = MigrationGenerator(diff_result)
    statements = generator.generate()

    output_lines = [
        "-- Schema Diff Migration",
        f"-- Source: {os.path.basename(args.old_snapshot)} -> {os.path.basename(args.new_snapshot)}",
        f"-- Generated: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}",
        f"-- Statements: {len(statements)}",
        "",
    ]
    output_lines.extend(statements)
    output_text = "\n".join(output_lines) + ("\n" if output_lines else "")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_text)
        print(f"Migration SQL saved to: {args.output}")
        print(f"  Statements: {len(statements)}")
    else:
        print(output_text, end="")

    return 0


def cmd_diff(args: argparse.Namespace) -> int:
    for path in [args.old_snapshot, args.new_snapshot]:
        if not os.path.isfile(path):
            print(f"Error: File not found: {path}", file=sys.stderr)
            return 1

    with open(args.old_snapshot, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(args.new_snapshot, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    differ = Differ(old_data, new_data)
    diff_result = differ.diff()

    tables = diff_result.get("tables", {})
    indices = diff_result.get("indices", {})

    print("=== Schema Diff Report ===")
    print(f"Tables added:   {len(tables.get('added', {}))}")
    print(f"Tables removed: {len(tables.get('removed', {}))}")
    print(f"Tables modified:{len(tables.get('modified', {}))}")
    print(f"Indices added:  {len(indices.get('added', {}))}")
    print(f"Indices removed:{len(indices.get('removed', {}))}")
    print(f"Indices modified:{len(indices.get('modified', {}))}")
    print()

    for name in tables.get("added", {}):
        print(f"+ ADD TABLE: {name}")
    for name in tables.get("removed", {}):
        print(f"- DROP TABLE: {name}")
    for name, changes in tables.get("modified", {}).items():
        print(f"~ MODIFY TABLE: {name}")
        for change_type, detail in changes.items():
            print(f"    {change_type}: {json.dumps(detail, ensure_ascii=False)}")
    for name in indices.get("added", {}):
        print(f"+ ADD INDEX: {name}")
    for name in indices.get("removed", {}):
        print(f"- DROP INDEX: {name}")
    for name in indices.get("modified", {}):
        print(f"~ MODIFY INDEX: {name}")

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="schema_diff",
        description="SQLite schema snapshot, diff, and migration SQL generator",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    snap_parser = subparsers.add_parser("snapshot", help="Take a schema snapshot of a SQLite database")
    snap_parser.add_argument("db_path", help="Path to the SQLite database file")
    snap_parser.add_argument("-o", "--output", help="Output JSON file path")
    snap_parser.set_defaults(func=cmd_snapshot)

    mig_parser = subparsers.add_parser("migrate", help="Generate migration SQL between two snapshots")
    mig_parser.add_argument("old_snapshot", help="Old snapshot JSON file")
    mig_parser.add_argument("new_snapshot", help="New snapshot JSON file")
    mig_parser.add_argument("-o", "--output", help="Output SQL file path")
    mig_parser.set_defaults(func=cmd_migrate)

    diff_parser = subparsers.add_parser("diff", help="Show a human-readable diff between two snapshots")
    diff_parser.add_argument("old_snapshot", help="Old snapshot JSON file")
    diff_parser.add_argument("new_snapshot", help="New snapshot JSON file")
    diff_parser.set_defaults(func=cmd_diff)

    return parser


def main(argv: list | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
