"""JSON report generation.

Produces a structured report containing the run metadata, a level-by-level
summary, and the full per-domain results. The report is what
``reports/inspection_report.json`` contains.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Dict, List

from .config import Config
from .inspector import (
    ALERT_LEVELS,
    LEVEL_CRITICAL,
    LEVEL_ERROR,
    LEVEL_EXPIRED,
    LEVEL_SAFE,
    LEVEL_WARNING,
)


def build_report(results: List[Dict], config: Config) -> Dict:
    """Assemble the full report dictionary from inspection results."""
    summary = {
        LEVEL_EXPIRED: 0,
        LEVEL_CRITICAL: 0,
        LEVEL_WARNING: 0,
        LEVEL_SAFE: 0,
        LEVEL_ERROR: 0,
    }
    for r in results:
        summary[r["level"]] = summary.get(r["level"], 0) + 1

    alert_results = [r for r in results if r["level"] in ALERT_LEVELS]
    successful = sum(1 for r in results if r["status"] == "success")

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "thresholds": {
            "expired": config.thresholds.expired,
            "critical": config.thresholds.critical,
            "warning": config.thresholds.warning,
        },
        "summary": {
            "total": len(results),
            "successful": successful,
            "errors": summary[LEVEL_ERROR],
            "alerts": len(alert_results),
            "by_level": summary,
        },
        "results": results,
        "alert_domains": [
            {
                "domain": r["domain"],
                "level": r["level"],
                "remaining_days": r.get("remaining_days"),
                "not_after": (r.get("server_certificate") or {}).get("not_after"),
            }
            for r in alert_results
        ],
    }


def write_report(report: Dict, path: str) -> str:
    """Write the report dict to ``path`` as pretty-printed JSON."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return path
