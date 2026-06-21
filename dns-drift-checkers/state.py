"""State persistence — tracks drift history across scans in a JSON file.

The state file records, for every active drift:

  * ``first_seen``       — ISO timestamp when the drift was first observed.
  * ``last_seen``        — ISO timestamp of the most recent scan that still
    saw the drift.
  * ``consecutive_days`` — how many *consecutive* days the drift has
    persisted.  Multiple scans on the same day do not inflate the count;
    a gap of more than one day resets it to 1.

Drifts that disappear between scans are removed from the state file,
signalling that the record has been corrected.
"""

import json
import os
from datetime import datetime, date

from diff_engine import drift_key


class StateManager:
    def __init__(self, path):
        self.path = path
        self.state = self._load()

    def _load(self):
        if os.path.isfile(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as fh:
                    return json.load(fh)
            except (json.JSONDecodeError, OSError):
                pass
        return {"last_scan": None, "drifts": {}}

    def _parse_ts(self, ts_str):
        if not ts_str:
            return None
        try:
            return datetime.fromisoformat(ts_str)
        except (ValueError, TypeError):
            return None

    def update(self, drifts_by_domain, scan_time):
        previous = self.state.get("drifts", {})
        current_keys = set()
        new_drifts = {}

        for domain, drifts in drifts_by_domain.items():
            for drift in drifts:
                key = drift_key(domain, drift)
                current_keys.add(key)

                old_entry = previous.get(key)
                if old_entry is not None:
                    first_seen = old_entry.get("first_seen", scan_time.isoformat())
                    old_ts = self._parse_ts(old_entry.get("last_seen"))
                    consecutive = self._calc_consecutive(old_ts, scan_time, old_entry)
                else:
                    first_seen = scan_time.isoformat()
                    consecutive = 1

                new_drifts[key] = {
                    "domain": domain,
                    "drift_type": drift["drift_type"],
                    "record_type": drift["record_type"],
                    "expected": drift["expected"],
                    "actual": drift["actual"],
                    "detail": drift.get("detail"),
                    "first_seen": first_seen,
                    "last_seen": scan_time.isoformat(),
                    "consecutive_days": consecutive,
                }

        self.state = {
            "last_scan": scan_time.isoformat(),
            "drifts": new_drifts,
        }

    @staticmethod
    def _calc_consecutive(old_ts, scan_time, old_entry):
        prev_days = old_entry.get("consecutive_days", 1)
        if old_ts is None:
            return 1

        old_date = old_ts.date()
        new_date = scan_time.date()
        day_gap = (new_date - old_date).days

        if day_gap <= 0:
            return prev_days
        elif day_gap == 1:
            return prev_days + 1
        else:
            return 1

    def save(self):
        with open(self.path, "w", encoding="utf-8") as fh:
            json.dump(self.state, fh, indent=2, ensure_ascii=False)

    def get_drift_meta(self, domain, drift):
        key = drift_key(domain, drift)
        return self.state.get("drifts", {}).get(key, {})

    @property
    def last_scan(self):
        return self.state.get("last_scan")
