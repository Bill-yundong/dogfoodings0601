"""Diff engine — classifies DNS record discrepancies into three categories.

Classification logic per record type (A / CNAME / MX):

  * **missing**  — a value declared in the baseline is absent from the live
    DNS response, and *no* unexpected value appeared to replace it.
  * **added**    — the live response contains a value that the baseline does
    not declare, and *no* expected value disappeared.
  * **tampered** — at least one expected value vanished *and* at least one
    unexpected value appeared.  This signals that a record was replaced
    rather than merely added or removed.  The vanished expected value is
    tagged ``tampered`` and carries the list of replacement values.
"""


DRIFT_MISSING = "missing"
DRIFT_ADDED = "added"
DRIFT_TAMPERED = "tampered"

DRIFT_LABELS = {
    DRIFT_MISSING: "缺失",
    DRIFT_ADDED: "新增",
    DRIFT_TAMPERED: "篡改",
}


class DiffEngine:

    @staticmethod
    def compare(expected, actual):
        expected_types = set(expected.keys())
        all_types = sorted(expected_types)

        drifts = []
        for rtype in all_types:
            exp_vals = set(expected.get(rtype, []))
            actual_entry = actual.get(rtype, {})
            actual_error = actual_entry.get("error")
            act_vals = set(actual_entry.get("records", []))

            if actual_error:
                for val in sorted(exp_vals):
                    drifts.append(_make_drift(
                        DRIFT_MISSING, rtype, expected=val, actual=None,
                        detail=f"resolver error: {actual_error}",
                    ))
                continue

            removed = exp_vals - act_vals
            added = act_vals - exp_vals

            if removed and added:
                added_sorted = sorted(added)
                for val in sorted(removed):
                    drifts.append(_make_drift(
                        DRIFT_TAMPERED, rtype, expected=val,
                        actual=added_sorted,
                    ))
            elif removed:
                for val in sorted(removed):
                    drifts.append(_make_drift(
                        DRIFT_MISSING, rtype, expected=val, actual=None,
                    ))
            elif added:
                for val in sorted(added):
                    drifts.append(_make_drift(
                        DRIFT_ADDED, rtype, expected=None, actual=val,
                    ))

        return drifts


def _make_drift(drift_type, record_type, expected, actual, detail=None):
    return {
        "drift_type": drift_type,
        "record_type": record_type,
        "expected": expected,
        "actual": actual,
        "detail": detail,
    }


def drift_key(domain, drift):
    drift_type = drift["drift_type"]
    expected = drift.get("expected")
    actual = drift.get("actual")

    if isinstance(expected, list):
        expected_str = ",".join(str(v) for v in expected)
    elif expected is None:
        expected_str = ""
    else:
        expected_str = str(expected)

    if drift_type in (DRIFT_TAMPERED, DRIFT_MISSING):
        return f"{domain}|{drift['record_type']}|{drift_type}|{expected_str}"

    if actual is None:
        actual_str = ""
    elif isinstance(actual, list):
        actual_str = ",".join(str(v) for v in actual)
    else:
        actual_str = str(actual)

    return f"{domain}|{drift['record_type']}|{drift_type}|{actual_str}"
