"""Reporter — renders the audit result as a human-readable, domain-grouped report.

Output sections:

  1. Header  — scan timestamp and baseline file.
  2. Body    — one block per domain that has drifts; each drift shows its
     type (缺失 / 新增 / 篡改), record type, expected vs. actual values,
     first-seen timestamp and consecutive-day count.
  3. Footer  — aggregate counts.
"""

from datetime import datetime

from diff_engine import DRIFT_LABELS


_TYPE_SYMBOLS = {
    "missing": "[-]",
    "added": "[+]",
    "tampered": "[!]",
}


def _format_value(value):
    if value is None:
        return "(无)"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return str(value)


def _format_ts(ts_str):
    if not ts_str:
        return "N/A"
    try:
        dt = datetime.fromisoformat(ts_str)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return ts_str


class Reporter:
    def __init__(self, baseline_path):
        self.baseline_path = baseline_path

    def generate(self, drifts_by_domain, state, all_domains):
        lines = []
        total_domains = len(all_domains)
        drift_domains = len(drifts_by_domain)
        total_drifts = sum(len(d) for d in drifts_by_domain.values())

        lines.append("=" * 68)
        lines.append("DNS 漂移巡检报告")
        lines.append(f"基线文件: {self.baseline_path}")
        lines.append(f"扫描时间: {_format_ts(state.get('last_scan'))}")
        lines.append(f"巡检域名: {total_domains} 个")
        lines.append("=" * 68)

        if total_drifts == 0:
            lines.append("")
            lines.append("  ✓ 所有记录与基线一致，未发现漂移。")
            lines.append("")
            lines.append("=" * 68)
            return "\n".join(lines)

        for domain in sorted(drifts_by_domain.keys()):
            drifts = drifts_by_domain[domain]
            if not drifts:
                continue

            lines.append("")
            lines.append("-" * 68)
            lines.append(f"域名: {domain}")
            lines.append("-" * 68)

            for drift in drifts:
                meta = state.get("drifts", {})
                from diff_engine import drift_key
                key = drift_key(domain, drift)
                meta_info = meta.get(key, {})

                symbol = _TYPE_SYMBOLS.get(drift["drift_type"], "[?]")
                label = DRIFT_LABELS.get(drift["drift_type"], drift["drift_type"])
                rtype = drift["record_type"]

                lines.append("")
                lines.append(f"  {symbol} {label} | {rtype}")

                if drift["drift_type"] == "added":
                    lines.append(f"      实际值: {_format_value(drift['actual'])}")
                elif drift["drift_type"] == "missing":
                    lines.append(f"      预期值: {_format_value(drift['expected'])}")
                else:
                    lines.append(f"      预期值: {_format_value(drift['expected'])}")
                    lines.append(f"      实际值: {_format_value(drift['actual'])}")

                if drift.get("detail"):
                    lines.append(f"      备注:   {drift['detail']}")

                first_seen = _format_ts(meta_info.get("first_seen"))
                consecutive = meta_info.get("consecutive_days", 1)
                lines.append(f"      首次发现: {first_seen}")
                lines.append(f"      连续漂移: {consecutive} 天")

        lines.append("")
        lines.append("=" * 68)
        lines.append(f"总计: {drift_domains}/{total_domains} 个域名存在漂移, 共 {total_drifts} 条异常记录")
        lines.append("=" * 68)

        return "\n".join(lines)
