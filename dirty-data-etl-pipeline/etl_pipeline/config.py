"""Central configuration for the ETL pipeline.

Defines the canonical target schema, the source-to-target field mapping
rules, duplicate-primary-key merge strategy, and the set of string tokens
that are treated as SQL NULL.  Keeping these rules in one place makes the
transform step declarative and easy to extend.
"""

from __future__ import annotations

from typing import Dict, FrozenSet, List, Tuple

TARGET_TABLE = "customers"

PRIMARY_KEY = "customer_id"

# (column_name, sqlite_type, python_cast_key)
# python_cast_key drives how a cleaned string value is coerced in the
# transformer before being handed to the loader.
TARGET_COLUMNS: List[Tuple[str, str, str]] = [
    ("customer_id", "TEXT", "str"),
    ("name", "TEXT", "str"),
    ("email", "TEXT", "str"),
    ("city", "TEXT", "str"),
    ("age", "INTEGER", "int"),
    ("amount", "REAL", "float"),
    ("remark", "TEXT", "str"),
    ("source_file", "TEXT", "str"),
    ("ingested_at", "TEXT", "str"),
]

TARGET_COLUMN_NAMES: List[str] = [c[0] for c in TARGET_COLUMNS]

TARGET_TYPES: Dict[str, str] = {c[0]: c[2] for c in TARGET_COLUMNS}

# Source header alias -> target column.  Lookup is case-insensitive and the
# keys are stored lower-cased / stripped so the transformer can normalise
# incoming headers before matching.
FIELD_MAP: Dict[str, str] = {
    "customer_id": "customer_id",
    "id": "customer_id",
    "cust_id": "customer_id",
    "customerid": "customer_id",
    "客户id": "customer_id",
    "客户编号": "customer_id",
    "name": "name",
    "姓名": "name",
    "customer_name": "name",
    "客户名称": "name",
    "email": "email",
    "邮箱": "email",
    "e-mail": "email",
    "mail": "email",
    "city": "city",
    "城市": "city",
    "age": "age",
    "年龄": "age",
    "amount": "amount",
    "金额": "amount",
    "total": "amount",
    "总额": "amount",
    "remark": "remark",
    "备注": "remark",
    "note": "remark",
    "notes": "remark",
}

# How to merge values across rows that share the same primary key.
#   "sum"            -> numeric sum (NULL/empty treated as 0 contribution)
#   "first_non_empty"-> first non-null, non-empty value wins; later rows only
#                      fill gaps that earlier rows left blank
MERGE_STRATEGY: Dict[str, str] = {
    "amount": "sum",
    "age": "first_non_empty",
    "name": "first_non_empty",
    "email": "first_non_empty",
    "city": "first_non_empty",
    "remark": "first_non_empty",
}

# Strings that are ambiguous between "empty" and "missing".  Any value that
# lower-cases/strips into one of these becomes SQL NULL rather than an empty
# string, which is how the pipeline resolves the NULL/empty-string ambiguity.
NULL_TOKENS: FrozenSet[str] = frozenset(
    {
        "",
        "null",
        "none",
        "nil",
        "n/a",
        "na",
        "-",
        "--",
        "undefined",
    }
)


def build_alias_lookup() -> Dict[str, str]:
    """Return a normalised (lower+strip) alias -> target column mapping."""
    return {alias.strip().lower(): target for alias, target in FIELD_MAP.items()}


ALIAS_LOOKUP: Dict[str, str] = build_alias_lookup()
