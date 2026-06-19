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
