from typing import Dict, List, Any, Set


DRIFT_ADDED = "added"
DRIFT_MISSING = "missing"
DRIFT_TAMPERED = "tampered"
DRIFT_OK = "ok"


class DiffEngine:
    def __init__(self):
        pass

    def _normalize_values(self, values: List[str]) -> Set[str]:
        normalized: Set[str] = set()
        for v in values or []:
            if not isinstance(v, str):
                continue
            trimmed = v.strip().rstrip(".")
            if trimmed:
                normalized.add(trimmed.lower())
        return normalized

    def compare_record_type(
        self,
        record_type: str,
        baseline_values: List[str],
        actual_values: List[str],
        actual_error: Any = None,
    ) -> Dict[str, Any]:
        baseline_set = self._normalize_values(baseline_values)
        actual_set = self._normalize_values(actual_values)

        if actual_error is not None:
            return {
                "type": record_type,
                "status": "error",
                "error": str(actual_error),
                "baseline": sorted(baseline_set),
                "actual": [],
                "diffs": [],
            }

        added = sorted(actual_set - baseline_set)
        missing = sorted(baseline_set - actual_set)

        diffs: List[Dict[str, Any]] = []
        for val in added:
            diffs.append({"category": DRIFT_ADDED, "value": val})
        for val in missing:
            diffs.append({"category": DRIFT_MISSING, "value": val})

        has_drift = len(diffs) > 0
        status = DRIFT_TAMPERED if has_drift else DRIFT_OK

        return {
            "type": record_type,
            "status": status,
            "baseline": sorted(baseline_set),
            "actual": sorted(actual_set),
            "added": added,
            "missing": missing,
            "diffs": diffs,
        }

    def compare_zone(
        self,
        zone_name: str,
        baseline_records: Dict[str, List[str]],
        probe_results: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        all_types = set(baseline_records.keys()) | set(probe_results.keys())

        record_comparisons: Dict[str, Dict[str, Any]] = {}
        has_any_drift = False
        summary = {DRIFT_ADDED: 0, DRIFT_MISSING: 0, "error": 0}

        for rtype in sorted(all_types):
            baseline_vals = baseline_records.get(rtype, [])
            probe_info = probe_results.get(rtype, {})
            actual_vals = probe_info.get("values", [])
            actual_error = probe_info.get("error")

            cmp = self.compare_record_type(rtype, baseline_vals, actual_vals, actual_error)
            record_comparisons[rtype] = cmp

            if cmp["status"] == DRIFT_TAMPERED:
                has_any_drift = True
                summary[DRIFT_ADDED] += len(cmp.get("added", []))
                summary[DRIFT_MISSING] += len(cmp.get("missing", []))
            elif cmp["status"] == "error":
                has_any_drift = True
                summary["error"] += 1

        return {
            "zone": zone_name,
            "status": DRIFT_TAMPERED if has_any_drift else DRIFT_OK,
            "records": record_comparisons,
            "summary": summary,
        }

    def compare_all(
        self,
        baseline_zones: Dict[str, Dict[str, List[str]]],
        all_probe_results: Dict[str, Dict[str, Dict[str, Any]]],
    ) -> Dict[str, Any]:
        zones_result: Dict[str, Dict[str, Any]] = {}
        global_summary = {
            "total_zones": len(baseline_zones),
            "drifted_zones": 0,
            "ok_zones": 0,
            DRIFT_ADDED: 0,
            DRIFT_MISSING: 0,
            "errors": 0,
        }

        for zone_name, baseline_records in baseline_zones.items():
            probe_results = all_probe_results.get(zone_name, {})
            result = self.compare_zone(zone_name, baseline_records, probe_results)
            zones_result[zone_name] = result

            if result["status"] == DRIFT_TAMPERED:
                global_summary["drifted_zones"] += 1
            else:
                global_summary["ok_zones"] += 1

            global_summary[DRIFT_ADDED] += result["summary"].get(DRIFT_ADDED, 0)
            global_summary[DRIFT_MISSING] += result["summary"].get(DRIFT_MISSING, 0)
            global_summary["errors"] += result["summary"].get("error", 0)

        return {
            "zones": zones_result,
            "summary": global_summary,
        }
