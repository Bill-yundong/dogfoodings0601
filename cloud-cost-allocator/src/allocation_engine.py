import json
import re
from typing import Dict, List, Optional, Tuple

from .database import Database


class AllocationEngine:
    def __init__(self, db: Database, rules: Dict):
        self.db = db
        self.rules = rules or {}
        self.cost_center_tag_keys = self.rules.get("cost_center_tags", ["CostCenter", "cost_center", "cc"])
        self.naming_rules = self.rules.get("naming_rules", [])
        self.shared_allocations = self.rules.get("shared_allocations", [])
        self.default_cost_center = self.rules.get("default_cost_center", "Unallocated")

    def _parse_tags(self, tags_json: Optional[str]) -> Dict[str, str]:
        if not tags_json:
            return {}
        try:
            return json.loads(tags_json)
        except (json.JSONDecodeError, ValueError):
            return {}

    def _match_cost_center_by_tags(self, tags: Dict[str, str]) -> Optional[str]:
        for key in self.cost_center_tag_keys:
            if key in tags and tags[key]:
                value = tags[key]
                tag_map = self.rules.get("tag_value_map", {})
                return tag_map.get(value, value)
        return None

    def _match_cost_center_by_name(self, resource_name: Optional[str], resource_id: Optional[str]) -> Optional[str]:
        haystack = f"{resource_name or ''} {resource_id or ''}"
        if not haystack.strip():
            return None
        for rule in self.naming_rules:
            pattern = rule.get("pattern")
            cost_center = rule.get("cost_center")
            if not pattern or not cost_center:
                continue
            try:
                if re.search(pattern, haystack, re.IGNORECASE):
                    return cost_center
            except re.error:
                continue
        return None

    def assign_cost_centers(self, billing_month: str) -> None:
        rows = self.db.query(
            "SELECT id, resource_name, resource_id, tags FROM billing_records WHERE billing_month = ?",
            (billing_month,),
        )

        updates: List[Tuple[Optional[str], Optional[str], int]] = []
        tag_match_count = 0
        name_match_count = 0
        unassigned_count = 0

        for row in rows:
            tags = self._parse_tags(row["tags"])
            cc = self._match_cost_center_by_tags(tags)
            assigned_by = "tag"
            if cc:
                tag_match_count += 1
            else:
                cc = self._match_cost_center_by_name(row["resource_name"], row["resource_id"])
                assigned_by = "name_pattern" if cc else None
                if cc:
                    name_match_count += 1

            if not cc:
                cc = self.default_cost_center
                assigned_by = "default"
                unassigned_count += 1

            updates.append((cc, assigned_by, row["id"]))

        self.db.executemany(
            "UPDATE billing_records SET cost_center = ?, assigned_by = ? WHERE id = ?",
            updates,
        )
        print(f"      → 标签归属 {tag_match_count} 条，命名规则归属 {name_match_count} 条，默认兜底 {unassigned_count} 条")

    def _get_weight_map(self, rule: Dict, billing_month: str) -> Dict[str, float]:
        weight_type = rule.get("weight_by", "equal")
        weights: Dict[str, float] = {}

        if weight_type == "fixed":
            return rule.get("weights", {})

        if weight_type == "tag_count":
            tag_key = rule.get("tag_key")
            tag_values = rule.get("tag_values", [])
            rows = self.db.query(
                "SELECT tags, cost FROM billing_records WHERE billing_month = ? AND cost_center IS NOT NULL",
                (billing_month,),
            )
            for row in rows:
                tags = self._parse_tags(row["tags"])
                if tag_key and tag_key in tags:
                    val = tags[tag_key]
                    if tag_values and val not in tag_values:
                        continue
                    weights[val] = weights.get(val, 0.0) + (row["cost"] or 0.0)

        elif weight_type == "resource_count":
            target_ccs = rule.get("target_cost_centers", [])
            for cc in target_ccs:
                cnt_row = self.db.query_one(
                    "SELECT COUNT(*) as cnt FROM billing_records WHERE billing_month = ? AND cost_center = ?",
                    (billing_month, cc),
                )
                weights[cc] = float(cnt_row["cnt"]) if cnt_row else 0.0

        elif weight_type == "usage":
            service_filter = rule.get("usage_service")
            target_ccs = rule.get("target_cost_centers", [])
            for cc in target_ccs:
                sql = "SELECT COALESCE(SUM(usage_quantity), 0) as total FROM billing_records WHERE billing_month = ? AND cost_center = ?"
                params: List = [billing_month, cc]
                if service_filter:
                    sql += " AND service_name = ?"
                    params.append(service_filter)
                row = self.db.query_one(sql, tuple(params))
                weights[cc] = float(row["total"]) if row else 0.0

        elif weight_type == "equal":
            for cc in rule.get("target_cost_centers", []):
                weights[cc] = 1.0

        if rule.get("target_cost_centers"):
            for cc in rule["target_cost_centers"]:
                weights.setdefault(cc, 0.0)

        return weights

    def _normalize_weights(self, weights: Dict[str, float]) -> Dict[str, float]:
        total = sum(weights.values())
        if total <= 0:
            n = len(weights) or 1
            return {k: 1.0 / n for k in weights}
        return {k: v / total for k, v in weights.items()}

    def _collect_shared_sources(self, rule: Dict, billing_month: str) -> List[Tuple[int, str, float]]:
        sources: List[Tuple[int, str, float]] = []

        if rule.get("source_cost_center"):
            rows = self.db.query(
                "SELECT id, cost_center, cost FROM billing_records WHERE billing_month = ? AND cost_center = ?",
                (billing_month, rule["source_cost_center"]),
            )
            for r in rows:
                sources.append((r["id"], r["cost_center"], r["cost"]))
        elif rule.get("source_resource_pattern"):
            pat = rule["source_resource_pattern"]
            rows = self.db.query(
                "SELECT id, cost_center, cost, resource_name, resource_id FROM billing_records WHERE billing_month = ?",
                (billing_month,),
            )
            for r in rows:
                haystack = f"{r['resource_name'] or ''} {r['resource_id'] or ''}"
                if re.search(pat, haystack, re.IGNORECASE):
                    sources.append((r["id"], r["cost_center"], r["cost"]))
        elif rule.get("source_service"):
            rows = self.db.query(
                "SELECT id, cost_center, cost FROM billing_records WHERE billing_month = ? AND service_name = ?",
                (billing_month, rule["source_service"]),
            )
            for r in rows:
                sources.append((r["id"], r["cost_center"], r["cost"]))

        return sources

    def run_allocations(self, billing_month: str) -> None:
        total_allocated = 0.0
        rule_count = 0

        for rule in self.shared_allocations:
            rule_name = rule.get("name", f"rule-{rule_count}")
            sources = self._collect_shared_sources(rule, billing_month)
            if not sources:
                continue

            raw_weights = self._get_weight_map(rule, billing_month)
            weights = self._normalize_weights(raw_weights)
            if not weights:
                continue

            alloc_records: List[Tuple] = []
            for src_id, src_cc, src_cost in sources:
                if src_cost <= 0:
                    continue
                for target_cc, ratio in weights.items():
                    allocated = src_cost * ratio
                    alloc_records.append((
                        billing_month,
                        src_id,
                        src_cc,
                        target_cc,
                        allocated,
                        ratio,
                        rule_name,
                    ))
                    total_allocated += allocated

            if alloc_records:
                self.db.executemany(
                    """INSERT INTO allocation_records
                    (billing_month, source_record_id, source_cost_center, target_cost_center,
                     allocated_cost, allocation_ratio, allocation_rule)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    alloc_records,
                )
                rule_count += 1

        self._save_monthly_summary(billing_month)
        print(f"      → 应用 {rule_count} 条分摊规则，累计分摊金额 ¥{total_allocated:,.2f}")

    def _save_monthly_summary(self, billing_month: str) -> None:
        rows = self.db.query(
            """SELECT cost_center,
                      SUM(cost) as total_direct,
                      COUNT(*) as cnt
               FROM billing_records
               WHERE billing_month = ? AND cost_center IS NOT NULL
               GROUP BY cost_center""",
            (billing_month,),
        )

        direct_map: Dict[str, Tuple[float, int]] = {}
        for r in rows:
            direct_map[r["cost_center"]] = (r["total_direct"] or 0.0, r["cnt"])

        in_rows = self.db.query(
            "SELECT target_cost_center, SUM(allocated_cost) as total_in FROM allocation_records WHERE billing_month = ? GROUP BY target_cost_center",
            (billing_month,),
        )
        in_map = {r["target_cost_center"]: (r["total_in"] or 0.0) for r in in_rows}

        out_rows = self.db.query(
            "SELECT source_cost_center, SUM(allocated_cost) as total_out FROM allocation_records WHERE billing_month = ? GROUP BY source_cost_center",
            (billing_month,),
        )
        out_map = {r["source_cost_center"]: (r["total_out"] or 0.0) for r in out_rows}

        all_ccs = set(direct_map.keys()) | set(in_map.keys()) | set(out_map.keys())

        summary_rows: List[Tuple] = []
        for cc in all_ccs:
            direct, cnt = direct_map.get(cc, (0.0, 0))
            alloc_in = in_map.get(cc, 0.0)
            alloc_out = out_map.get(cc, 0.0)
            total = direct + alloc_in - alloc_out
            summary_rows.append((billing_month, cc, total, direct, alloc_in, alloc_out, cnt))

        self.db.executemany(
            """INSERT OR REPLACE INTO monthly_summary
            (billing_month, cost_center, total_cost, direct_cost, allocated_in_cost,
             allocated_out_cost, record_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            summary_rows,
        )
