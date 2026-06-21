import json
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional


DEFAULT_STATE_FILE = "drift_state.json"
DEFAULT_REPORT_FILE = "drift_report.json"


class ReportManager:
    def __init__(self, state_file: str = DEFAULT_STATE_FILE, report_file: str = DEFAULT_REPORT_FILE):
        self.state_file = state_file
        self.report_file = report_file
        self.state = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        if not os.path.exists(self.state_file):
            return {"zones": {}, "last_scan": None}
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {"zones": {}, "last_scan": None}

    def _save_state(self) -> None:
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(self.state, f, indent=2, ensure_ascii=False)

    def _save_report(self, report: Dict[str, Any]) -> None:
        with open(self.report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _days_between(self, iso_start: str, iso_end: str) -> int:
        try:
            start = datetime.fromisoformat(iso_start.replace("Z", "+00:00"))
            end = datetime.fromisoformat(iso_end.replace("Z", "+00:00"))
            delta = end - start
            return max(0, delta.days)
        except (ValueError, AttributeError):
            return 0

    def _make_diff_key(self, zone: str, rtype: str, category: str, value: str) -> str:
        return f"{zone}|{rtype}|{category}|{value}"

    def update_state(self, diff_results: Dict[str, Any]) -> Dict[str, Any]:
        now_iso = self._now_iso()
        self.state["last_scan"] = now_iso

        zones_state: Dict[str, Any] = self.state.setdefault("zones", {})
        active_keys: set = set()

        for zone_name, zone_data in diff_results["zones"].items():
            zone_state: Dict[str, Any] = zones_state.setdefault(zone_name, {"records": {}})

            zone_state["last_status"] = zone_data["status"]
            zone_state["last_scan"] = now_iso

            if zone_data["status"] == "tampered":
                if "first_drift_at" not in zone_state or zone_state["first_drift_at"] is None:
                    zone_state["first_drift_at"] = now_iso
                zone_state["last_drift_at"] = now_iso

                zone_state["consecutive_days"] = self._days_between(
                    zone_state["first_drift_at"], now_iso
                )
            else:
                if "first_drift_at" in zone_state:
                    del zone_state["first_drift_at"]
                if "last_drift_at" in zone_state:
                    del zone_state["last_drift_at"]
                zone_state["consecutive_days"] = 0

            for rtype, rec_data in zone_data["records"].items():
                rec_state = zone_state["records"].setdefault(rtype, {"diffs": {}})
                rec_state["last_status"] = rec_data["status"]

                for diff in rec_data.get("diffs", []):
                    category = diff["category"]
                    value = diff["value"]
                    key = self._make_diff_key(zone_name, rtype, category, value)
                    active_keys.add(key)

                    diff_state = rec_state["diffs"].get(key, {})
                    if not diff_state:
                        diff_state["first_seen"] = now_iso
                    diff_state["last_seen"] = now_iso
                    diff_state["category"] = category
                    diff_state["value"] = value

                    diff_state["consecutive_days"] = self._days_between(
                        diff_state["first_seen"], now_iso
                    )

                    rec_state["diffs"][key] = diff_state

                stale_keys = [k for k in rec_state["diffs"].keys() if k not in active_keys]
                for sk in stale_keys:
                    del rec_state["diffs"][sk]

        self._save_state()
        return self.state

    def build_report(self, diff_results: Dict[str, Any]) -> Dict[str, Any]:
        now_iso = self._now_iso()
        zones_report: Dict[str, Any] = {}

        for zone_name, zone_data in diff_results["zones"].items():
            zone_state = self.state.get("zones", {}).get(zone_name, {})
            records_report: Dict[str, Any] = {}

            for rtype, rec_data in zone_data["records"].items():
                rec_state = zone_state.get("records", {}).get(rtype, {})

                diffs_with_meta: List[Dict[str, Any]] = []
                for diff in rec_data.get("diffs", []):
                    key = self._make_diff_key(zone_name, rtype, diff["category"], diff["value"])
                    diff_meta = rec_state.get("diffs", {}).get(key, {})

                    diffs_with_meta.append({
                        "category": diff["category"],
                        "value": diff["value"],
                        "first_seen": diff_meta.get("first_seen", now_iso),
                        "consecutive_days": diff_meta.get("consecutive_days", 1),
                    })

                record_entry = {
                    "status": rec_data["status"],
                    "baseline": rec_data.get("baseline", []),
                    "actual": rec_data.get("actual", []),
                    "diffs": diffs_with_meta,
                }
                if "error" in rec_data:
                    record_entry["error"] = rec_data["error"]
                records_report[rtype] = record_entry

            zones_report[zone_name] = {
                "status": zone_data["status"],
                "summary": zone_data["summary"],
                "first_drift_at": zone_state.get("first_drift_at"),
                "consecutive_drift_days": zone_state.get("consecutive_days", 0),
                "records": records_report,
            }

        report = {
            "generated_at": now_iso,
            "summary": diff_results["summary"],
            "zones": zones_report,
        }

        self._save_report(report)
        return report

    @staticmethod
    def render_console(report: Dict[str, Any]) -> str:
        lines: List[str] = []
        lines.append("=" * 70)
        lines.append("  DNS 记录漂移巡检报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {report['generated_at']}")
        s = report["summary"]
        lines.append(
            f"总览: {s['total_zones']} 个域名 | "
            f"漂移: {s['drifted_zones']} | 正常: {s['ok_zones']} | "
            f"新增: {s['added']} | 缺失: {s['missing']} | 错误: {s['errors']}"
        )
        lines.append("")

        for zone_name, zone_data in sorted(report["zones"].items()):
            status_icon = "✘" if zone_data["status"] == "tampered" else "✔"
            status_text = "漂移" if zone_data["status"] == "tampered" else "正常"
            lines.append(f"[{status_icon}] {zone_name}  —— {status_text}")

            if zone_data["first_drift_at"]:
                lines.append(
                    f"    首次漂移: {zone_data['first_drift_at']}  |  "
                    f"连续漂移: {zone_data['consecutive_drift_days']} 天"
                )

            for rtype, rec in sorted(zone_data["records"].items()):
                lines.append(f"    {rtype} 记录:")
                lines.append(f"      基线: {rec.get('baseline', [])}")
                lines.append(f"      实际: {rec.get('actual', [])}")

                if "error" in rec:
                    lines.append(f"      错误: {rec['error']}")

                if rec["diffs"]:
                    for d in rec["diffs"]:
                        cat_label = {
                            "added": "新增 +",
                            "missing": "缺失 -",
                        }.get(d["category"], d["category"])
                        lines.append(
                            f"        {cat_label} {d['value']}"
                            f"  (首次发现: {d['first_seen']}, 连续: {d['consecutive_days']} 天)"
                        )

            lines.append("-" * 70)

        return "\n".join(lines)
