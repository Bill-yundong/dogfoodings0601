import csv
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .database import Database


PROVIDER_FIELD_MAPPINGS = {
    "aliyun": {
        "service_name": ["ProductCode", "ProductName", "产品名称", "产品代码"],
        "resource_id": ["ResourceId", "资源ID", "InstanceId"],
        "resource_name": ["ResourceName", "资源名称", "InstanceName"],
        "tags": ["Tags", "标签"],
        "cost": ["PretaxGrossAmount", "PretaxAmount", "原价", "应付金额", "Cost"],
        "currency": ["Currency", "货币单位"],
        "usage_quantity": ["Usage", "UsageQuantity", "使用量"],
        "usage_unit": ["UsageUnit", "使用量单位"],
        "region": ["Region", "地域"],
        "billing_month": ["BillingCycle", "账单周期"],
    },
    "aws": {
        "service_name": ["ProductName", "lineItem/ProductCode"],
        "resource_id": ["ResourceId", "lineItem/ResourceId"],
        "resource_name": ["ResourceName"],
        "tags": ["Tags", "resourceTags"],
        "cost": ["BlendedCost", "UnblendedCost", "lineItem/UnblendedCost"],
        "currency": ["Currency", "lineItem/CurrencyCode"],
        "usage_quantity": ["UsageQuantity", "lineItem/UsageAmount"],
        "usage_unit": ["UsageUnit", "lineItem/UsageUnit"],
        "region": ["Region", "lineItem/AvailabilityZone"],
        "billing_month": ["BillingPeriodStart", "bill/BillingPeriodStartDate"],
    },
    "tencent": {
        "service_name": ["ProductName", "产品名称"],
        "resource_id": ["ResourceId", "资源ID", "InstanceId"],
        "resource_name": ["ResourceName", "资源名称"],
        "tags": ["Tags", "标签"],
        "cost": ["RealTotalCost", "TotalCost", "原价", "总成本"],
        "currency": ["Currency"],
        "usage_quantity": ["UsageValue", "UsageQuantity"],
        "usage_unit": ["UsageUnit"],
        "region": ["Region", "区域"],
        "billing_month": ["BillingMonth", "Month"],
    },
    "generic": {
        "service_name": ["service", "service_name", "product", "产品"],
        "resource_id": ["resource_id", "resourceId", "资源ID"],
        "resource_name": ["resource_name", "resourceName", "资源名称"],
        "tags": ["tags", "标签"],
        "cost": ["cost", "amount", "price", "费用", "金额"],
        "currency": ["currency", "货币"],
        "usage_quantity": ["usage", "quantity", "用量", "使用量"],
        "usage_unit": ["unit", "单位"],
        "region": ["region", "区域", "地域"],
        "billing_month": ["month", "billing_month", "月份", "账单月份"],
    },
}


def _detect_provider(headers: List[str]) -> str:
    header_set = set(headers)
    aliyun_indicators = {"ProductCode", "PretaxGrossAmount", "BillingCycle", "产品名称"}
    aws_indicators = {"lineItem/ProductCode", "lineItem/UnblendedCost", "bill/BillingPeriodStartDate"}
    tencent_indicators = {"RealTotalCost", "BillingMonth"}

    if aliyun_indicators & header_set:
        return "aliyun"
    if aws_indicators & header_set:
        return "aws"
    if tencent_indicators & header_set:
        return "tencent"
    return "generic"


def _pick_field(row: Dict, field_candidates: List[str]) -> Optional[str]:
    for cand in field_candidates:
        if cand in row and row[cand] is not None and str(row[cand]).strip() != "":
            return str(row[cand]).strip()
    return None


def _parse_cost(val: Optional[str]) -> float:
    if not val:
        return 0.0
    try:
        cleaned = val.replace(",", "").replace("¥", "").replace("$", "").strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return 0.0


def _parse_usage(val: Optional[str]) -> Optional[float]:
    if not val:
        return None
    try:
        cleaned = val.replace(",", "").strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def _parse_tags(raw: Optional[str]) -> Dict[str, str]:
    if not raw:
        return {}
    tags: Dict[str, str] = {}

    if raw.startswith("{"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return {str(k): str(v) for k, v in parsed.items()}
        except (json.JSONDecodeError, ValueError):
            pass

    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        k = item.get("Key") or item.get("key")
                        v = item.get("Value") or item.get("value")
                        if k:
                            tags[str(k)] = str(v or "")
                return tags
        except (json.JSONDecodeError, ValueError):
            pass

    for part in re.split(r"[;&,\n]", raw):
        part = part.strip()
        if not part:
            continue
        if "=" in part:
            k, v = part.split("=", 1)
            tags[k.strip()] = v.strip()
        elif ":" in part:
            k, v = part.split(":", 1)
            tags[k.strip()] = v.strip()
    return tags


def _normalize_billing_month(raw: Optional[str]) -> str:
    if not raw:
        return datetime.now().strftime("%Y-%m")
    raw = raw.strip()
    m = re.match(r"(\d{4})[-/](\d{1,2})", raw)
    if m:
        year, month = m.group(1), m.group(2)
        return f"{year}-{int(month):02d}"
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m")
    except ValueError:
        return datetime.now().strftime("%Y-%m")


class BillingImporter:
    def __init__(self, db: Database):
        self.db = db

    def import_csv(self, csv_path: str) -> str:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            provider = _detect_provider(headers)
            mapping = PROVIDER_FIELD_MAPPINGS.get(provider, PROVIDER_FIELD_MAPPINGS["generic"])

            rows_to_insert: List[Tuple] = []
            billing_month: Optional[str] = None

            for row in reader:
                record_month = _normalize_billing_month(_pick_field(row, mapping["billing_month"]))
                if billing_month is None:
                    billing_month = record_month

                tags_raw = _pick_field(row, mapping["tags"])
                tags_dict = _parse_tags(tags_raw)

                record = (
                    record_month,
                    provider,
                    _pick_field(row, mapping["service_name"]) or "Unknown",
                    _pick_field(row, mapping["resource_id"]),
                    _pick_field(row, mapping["resource_name"]),
                    json.dumps(tags_dict, ensure_ascii=False),
                    _parse_cost(_pick_field(row, mapping["cost"])),
                    _pick_field(row, mapping["currency"]) or "CNY",
                    _parse_usage(_pick_field(row, mapping["usage_quantity"])),
                    _pick_field(row, mapping["usage_unit"]),
                    _pick_field(row, mapping["region"]),
                    json.dumps(row, ensure_ascii=False),
                    None,
                    None,
                )
                rows_to_insert.append(record)

        if billing_month is None:
            billing_month = datetime.now().strftime("%Y-%m")

        self.db.clear_month(billing_month)

        insert_sql = """
            INSERT INTO billing_records
            (billing_month, provider, service_name, resource_id, resource_name,
             tags, cost, currency, usage_quantity, usage_unit, region, raw_data,
             cost_center, assigned_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        self.db.executemany(insert_sql, rows_to_insert)

        total_cost = sum(r[6] for r in rows_to_insert)
        print(f"      → 导入 {len(rows_to_insert)} 条记录，总费用 ¥{total_cost:,.2f}，检测厂商: {provider}")

        return billing_month
