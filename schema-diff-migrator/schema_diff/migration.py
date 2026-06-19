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
