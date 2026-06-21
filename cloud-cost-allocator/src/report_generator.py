import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from tabulate import tabulate

from .database import Database


class ReportGenerator:
    def __init__(self, db: Database, output_dir: str = "./reports", rules: Optional[Dict] = None):
        self.db = db
        self.output_dir = output_dir
        self.rules = rules or {}
        self.budgets = self.rules.get("budgets", {})
        os.makedirs(self.output_dir, exist_ok=True)

    def _calc_budget_alerts(self, cur_summary: Dict[str, Dict]) -> List[Dict]:
        alerts: List[Dict] = []
        for cc, data in cur_summary.items():
            budget = self.budgets.get(cc)
            if budget is None or budget <= 0:
                continue
            actual = data["total_cost"]
            ratio = actual / budget * 100
            level = None
            if ratio >= 100:
                level = "RED"
            elif ratio >= 80:
                level = "YELLOW"
            if level:
                alerts.append({
                    "cost_center": cc,
                    "budget": budget,
                    "actual": actual,
                    "ratio": round(ratio, 2),
                    "level": level,
                    "diff": round(actual - budget, 2),
                })
        alerts.sort(key=lambda x: (-x["ratio"], x["cost_center"]))
        return alerts

    def _generate_tag_coverage_report(self, billing_month: str, total_cost: float) -> Dict:
        rows = self.db.query(
            """SELECT service_name, resource_name, resource_id, cost, tags, assigned_by
               FROM billing_records
               WHERE billing_month = ? AND assigned_by = 'default'
               ORDER BY cost DESC""",
            (billing_month,),
        )
        service_groups: Dict[str, Dict] = {}
        detail_rows: List[List] = []
        total_untagged_cost = 0.0
        total_untagged_count = 0

        for r in rows:
            svc = r["service_name"] or "Unknown"
            cost = r["cost"] or 0.0
            total_untagged_cost += cost
            total_untagged_count += 1
            if svc not in service_groups:
                service_groups[svc] = {"count": 0, "cost": 0.0}
            service_groups[svc]["count"] += 1
            service_groups[svc]["cost"] += cost
            detail_rows.append([
                svc,
                r["resource_name"] or "",
                r["resource_id"] or "",
                f"{cost:.2f}",
                r["tags"] or "{}",
            ])

        coverage_csv = os.path.join(self.output_dir, f"tag-coverage-{billing_month}.csv")
        with open(coverage_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["【标签覆盖率汇总】", "", "", "", ""])
            overall_pct = (total_untagged_cost / total_cost * 100) if total_cost > 0 else 0.0
            writer.writerow(["无标签资源数", total_untagged_count, "", "", ""])
            writer.writerow(["无标签总费用(¥)", f"{total_untagged_cost:.2f}", "", "", ""])
            writer.writerow(["费用占比(%)", f"{overall_pct:.2f}", "", "", ""])
            writer.writerow([])
            writer.writerow(["【按服务分组】", "", "", "", ""])
            writer.writerow(["服务名", "资源数", "费用(¥)", "分组占比(%)", ""])
            for svc in sorted(service_groups.keys(), key=lambda x: -service_groups[x]["cost"]):
                info = service_groups[svc]
                svc_pct = (info["cost"] / total_untagged_cost * 100) if total_untagged_cost > 0 else 0.0
                writer.writerow([svc, info["count"], f"{info['cost']:.2f}", f"{svc_pct:.2f}"])
            writer.writerow([])
            writer.writerow(["【Unallocated 资源明细】", "", "", "", ""])
            writer.writerow(["服务名", "资源名称", "资源ID", "费用(¥)", "标签原始值"])
            for row in detail_rows:
                writer.writerow(row)

        return {
            "untagged_count": total_untagged_count,
            "untagged_cost": round(total_untagged_cost, 2),
            "cost_percentage": round(overall_pct, 2) if total_cost > 0 else 0.0,
            "by_service": {
                svc: {
                    "count": info["count"],
                    "cost": round(info["cost"], 2),
                    "group_percentage": round((info["cost"] / total_untagged_cost * 100), 2) if total_untagged_cost > 0 else 0.0,
                }
                for svc, info in service_groups.items()
            },
        }

    def _load_summary(self, billing_month: str) -> Dict[str, Dict]:
        rows = self.db.query(
            "SELECT * FROM monthly_summary WHERE billing_month = ? ORDER BY total_cost DESC",
            (billing_month,),
        )
        result: Dict[str, Dict] = {}
        for r in rows:
            result[r["cost_center"]] = {
                "total_cost": r["total_cost"] or 0.0,
                "direct_cost": r["direct_cost"] or 0.0,
                "allocated_in": r["allocated_in_cost"] or 0.0,
                "allocated_out": r["allocated_out_cost"] or 0.0,
                "record_count": r["record_count"] or 0,
            }
        return result

    def _calc_mom(self, current: float, previous: float) -> Tuple[Optional[float], str]:
        if previous is None or previous == 0:
            return None, "N/A"
        rate = (current - previous) / previous * 100
        symbol = "↑" if rate > 0 else ("↓" if rate < 0 else "→")
        return rate, f"{rate:+.2f}% {symbol}"

    def _get_service_breakdown(self, billing_month: str, cost_center: str) -> List[Dict]:
        rows = self.db.query(
            """SELECT service_name, SUM(cost) as total
               FROM billing_records
               WHERE billing_month = ? AND cost_center = ?
               GROUP BY service_name
               ORDER BY total DESC""",
            (billing_month, cost_center),
        )
        return [{"service": r["service_name"], "cost": r["total"] or 0.0} for r in rows]

    def _get_top_growth_items(
        self, current_month: str, prev_month: Optional[str], limit: int = 10
    ) -> List[Dict]:
        if not prev_month:
            return []

        cur_rows = self.db.query(
            """SELECT cost_center, service_name, SUM(cost) as total
               FROM billing_records
               WHERE billing_month = ?
               GROUP BY cost_center, service_name""",
            (current_month,),
        )
        cur_map: Dict[Tuple[str, str], float] = {}
        for r in cur_rows:
            cur_map[(r["cost_center"], r["service_name"])] = r["total"] or 0.0

        prev_rows = self.db.query(
            """SELECT cost_center, service_name, SUM(cost) as total
               FROM billing_records
               WHERE billing_month = ?
               GROUP BY cost_center, service_name""",
            (prev_month,),
        )
        prev_map: Dict[Tuple[str, str], float] = {}
        for r in prev_rows:
            prev_map[(r["cost_center"], r["service_name"])] = r["total"] or 0.0

        items: List[Dict] = []
        all_keys = set(cur_map.keys()) | set(prev_map.keys())
        for key in all_keys:
            cur_val = cur_map.get(key, 0.0)
            prev_val = prev_map.get(key, 0.0)
            diff = cur_val - prev_val
            if prev_val > 0:
                mom = (diff / prev_val) * 100
            else:
                mom = float("inf") if cur_val > 0 else 0.0
            items.append({
                "cost_center": key[0],
                "service": key[1],
                "current": cur_val,
                "previous": prev_val,
                "diff": diff,
                "mom": mom,
            })

        items.sort(key=lambda x: x["diff"], reverse=True)
        return items[:limit]

    def _get_allocation_details(self, billing_month: str) -> List[Dict]:
        rows = self.db.query(
            """SELECT a.allocation_rule, a.source_cost_center, a.target_cost_center,
                      SUM(a.allocated_cost) as total,
                      COUNT(*) as cnt
               FROM allocation_records a
               WHERE a.billing_month = ?
               GROUP BY a.allocation_rule, a.source_cost_center, a.target_cost_center
               ORDER BY total DESC""",
            (billing_month,),
        )
        return [
            {
                "rule": r["allocation_rule"],
                "from": r["source_cost_center"],
                "to": r["target_cost_center"],
                "amount": r["total"] or 0.0,
                "records": r["cnt"],
            }
            for r in rows
        ]

    def generate_monthly_report(self, current_month: str, prev_month: Optional[str]) -> None:
        cur_summary = self._load_summary(current_month)
        prev_summary = self._load_summary(prev_month) if prev_month else {}

        total_cur = sum(v["total_cost"] for v in cur_summary.values())
        total_prev = sum(v["total_cost"] for v in prev_summary.values()) if prev_summary else None
        _, total_mom_str = self._calc_mom(total_cur, total_prev)

        summary_lines: List[List[str]] = []
        for cc, data in cur_summary.items():
            prev_data = prev_summary.get(cc, {})
            prev_total = prev_data.get("total_cost")
            rate, mom_str = self._calc_mom(data["total_cost"], prev_total or 0)
            pct = (data["total_cost"] / total_cur * 100) if total_cur > 0 else 0.0
            summary_lines.append([
                cc,
                f"¥{data['total_cost']:,.2f}",
                f"¥{data['direct_cost']:,.2f}",
                f"¥{data['allocated_in']:,.2f}",
                f"¥{data['allocated_out']:,.2f}",
                mom_str,
                f"{pct:.2f}%",
                str(data["record_count"]),
            ])

        top_growth = self._get_top_growth_items(current_month, prev_month)
        alloc_details = self._get_allocation_details(current_month)
        alerts = self._calc_budget_alerts(cur_summary)
        tag_coverage = self._generate_tag_coverage_report(current_month, total_cur)

        summary_csv = os.path.join(self.output_dir, f"summary-{current_month}.csv")
        with open(summary_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "成本中心", "总费用(¥)", "直接费用(¥)", "分摊转入(¥)", "分摊转出(¥)",
                "环比", "占比(%)", "账单记录数",
            ])
            for line in summary_lines:
                writer.writerow(line)

        detail_csv = os.path.join(self.output_dir, f"details-{current_month}.csv")
        with open(detail_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["成本中心", "服务", "费用(¥)"])
            for cc in cur_summary.keys():
                for svc in self._get_service_breakdown(current_month, cc):
                    writer.writerow([cc, svc["service"], f"{svc['cost']:.2f}"])

        alloc_csv = os.path.join(self.output_dir, f"allocations-{current_month}.csv")
        with open(alloc_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["分摊规则", "源成本中心", "目标成本中心", "分摊金额(¥)", "记录数"])
            for a in alloc_details:
                writer.writerow([a["rule"], a["from"], a["to"], f"{a['amount']:.2f}", a["records"]])

        if top_growth:
            growth_csv = os.path.join(self.output_dir, f"top-growth-{current_month}.csv")
            with open(growth_csv, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["排名", "成本中心", "服务", "本月(¥)", "上月(¥)", "增长额(¥)", "增长率(%)"])
                for idx, item in enumerate(top_growth, 1):
                    mom_str = f"{item['mom']:.2f}" if item["mom"] != float("inf") else "N/A"
                    writer.writerow([
                        idx, item["cost_center"], item["service"],
                        f"{item['current']:.2f}", f"{item['previous']:.2f}",
                        f"{item['diff']:.2f}", mom_str,
                    ])

        report_txt = os.path.join(self.output_dir, f"report-{current_month}.txt")
        with open(report_txt, "w", encoding="utf-8") as f:
            f.write(f"{'=' * 80}\n")
            f.write(f"云账单成本分摊月度报告\n")
            f.write(f"账单月份: {current_month}\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"{'=' * 80}\n\n")

            f.write(f"【整体概览】\n")
            f.write(f"  总费用: ¥{total_cur:,.2f}\n")
            if total_prev is not None:
                f.write(f"  上月费用: ¥{total_prev:,.2f}\n")
                f.write(f"  环比: {total_mom_str}\n")
            f.write(f"  成本中心数: {len(cur_summary)}\n\n")

            f.write(f"【分部门汇总】\n")
            f.write(tabulate(
                summary_lines,
                headers=[
                    "成本中心", "总费用", "直接费用", "分摊转入", "分摊转出",
                    "环比", "占比", "记录数",
                ],
                tablefmt="grid",
                stralign="left",
                numalign="right",
            ))
            f.write("\n\n")

            if top_growth:
                f.write(f"【Top 10 费用增长项】\n")
                growth_lines = []
                for idx, item in enumerate(top_growth, 1):
                    mom_str = f"{item['mom']:+.2f}%" if item["mom"] != float("inf") else "新增"
                    growth_lines.append([
                        str(idx),
                        item["cost_center"],
                        item["service"],
                        f"¥{item['current']:,.2f}",
                        f"¥{item['previous']:,.2f}",
                        f"¥{item['diff']:+,.2f}",
                        mom_str,
                    ])
                f.write(tabulate(
                    growth_lines,
                    headers=["排名", "成本中心", "服务", "本月", "上月", "增长额", "增长率"],
                    tablefmt="grid",
                ))
                f.write("\n\n")

            if alloc_details:
                f.write(f"【分摊明细】\n")
                alloc_lines = [
                    [a["rule"], a["from"] or "N/A", a["to"], f"¥{a['amount']:,.2f}", str(a["records"])]
                    for a in alloc_details
                ]
                f.write(tabulate(
                    alloc_lines,
                    headers=["规则", "源", "目标", "金额", "记录数"],
                    tablefmt="grid",
                ))
                f.write("\n\n")

            if alerts:
                f.write(f"【预算告警】\n")
                alert_lines = []
                for a in alerts:
                    icon = "🔴" if a["level"] == "RED" else "🟡"
                    label = "红色-超预算" if a["level"] == "RED" else "黄色-临近预算"
                    alert_lines.append([
                        f"{icon} {label}",
                        a["cost_center"],
                        f"¥{a['budget']:,.2f}",
                        f"¥{a['actual']:,.2f}",
                        f"{a['ratio']:.1f}%",
                        f"¥{a['diff']:+,.2f}",
                    ])
                f.write(tabulate(
                    alert_lines,
                    headers=["告警级别", "成本中心", "月度预算", "实际总费用", "预算使用率", "超支金额"],
                    tablefmt="grid",
                ))
                f.write("\n")
            else:
                f.write(f"【预算告警】\n  ✅ 所有成本中心均在预算范围内\n\n")

            f.write(f"【标签覆盖率】\n")
            f.write(f"  无标签兜底资源数: {tag_coverage['untagged_count']}\n")
            f.write(f"  无标签总费用: ¥{tag_coverage['untagged_cost']:,.2f}\n")
            f.write(f"  费用占比: {tag_coverage['cost_percentage']:.2f}%\n")
            if tag_coverage["by_service"]:
                f.write(f"  按服务分组:\n")
                for svc, info in tag_coverage["by_service"].items():
                    f.write(f"    - {svc}: {info['count']} 条 / ¥{info['cost']:,.2f} / {info['group_percentage']:.1f}%\n")
            f.write("\n")

        summary_json = os.path.join(self.output_dir, f"report-{current_month}.json")
        with open(summary_json, "w", encoding="utf-8") as f:
            json.dump({
                "billing_month": current_month,
                "previous_month": prev_month,
                "generated_at": datetime.now().isoformat(),
                "total_cost": total_cur,
                "total_cost_previous": total_prev,
                "mom_rate": ((total_cur - (total_prev or 0)) / (total_prev or 1) * 100) if total_prev else None,
                "cost_centers": cur_summary,
                "top_growth": top_growth,
                "allocations": alloc_details,
                "alerts": alerts,
                "tag_coverage": tag_coverage,
            }, f, ensure_ascii=False, indent=2, default=lambda x: str(x) if x == float("inf") else x)

        print(f"      → 生成文件:")
        print(f"         - summary-{current_month}.csv")
        print(f"         - details-{current_month}.csv")
        print(f"         - allocations-{current_month}.csv")
        if top_growth:
            print(f"         - top-growth-{current_month}.csv")
        print(f"         - tag-coverage-{current_month}.csv")
        print(f"         - report-{current_month}.txt")
        print(f"         - report-{current_month}.json")
