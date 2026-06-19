"""Transformation layer.

Takes the rows the cleaner produced (:class:`CleanSuccess`) and converts them
into rows that are ready to be written into the target SQLite table.

Three jobs live here:

1. **Field mapping.**  Source headers are looked up in
   :data:`etl_pipeline.config.ALIAS_LOOKUP` to decide which target column, if
   any, each source field corresponds to.  Unmapped source columns are
   silently dropped.

2. **NULL / empty-string disambiguation.**  Values in
   :data:`etl_pipeline.config.NULL_TOKENS` are normalised to Python ``None``
   (which the SQLite driver writes as ``NULL``).  A genuinely *empty* value
   that was *not* listed in NULL_TOKENS is still written as an empty string,
   which is how the pipeline preserves the semantic difference between the
   two.

3. **Duplicate-primary-key merging.**  When two rows share the same primary
   key, the transformer merges them according to
   :data:`etl_pipeline.config.MERGE_STRATEGY`.  A numeric field configured
   with ``sum`` is added up; a textual field configured with
   ``first_non_empty`` keeps the first value it received that wasn't empty /
   NULL.

Rows that *cannot* be transformed (e.g. their primary-key field is empty)
are written to the quarantine queue under stage ``transform``.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

from .cleaner import CleanSuccess
from .config import (
    ALIAS_LOOKUP,
    MERGE_STRATEGY,
    NULL_TOKENS,
    PRIMARY_KEY,
    TARGET_COLUMN_NAMES,
    TARGET_TYPES,
)
from .quarantine import QuarantineRecord


@dataclass
class TransformSuccess:
    """A row fully normalised against the target schema, ready to load."""

    values: Dict[str, object]
    source_file: str
    source_line: int


@dataclass
class TransformFailure:
    """A cleaned row that still violated a transform rule."""

    source_file: str
    source_line: int
    reason: str
    raw: str


@dataclass
class TransformResult:
    successes: List[TransformSuccess] = field(default_factory=list)
    failures: List[TransformFailure] = field(default_factory=list)
    # pk -> number of duplicate rows that were merged into it
    merged_duplicates: Dict[str, int] = field(default_factory=dict)


def _is_null_token(raw: str) -> bool:
    return raw.strip().lower() in NULL_TOKENS


def _map_header(source_header: str) -> Optional[str]:
    return ALIAS_LOOKUP.get(source_header.strip().lower())


def _coerce(value: Optional[str], type_key: str) -> object:
    """Coerce a cleaned, nullable string into the declared Python type.

    ``None`` is returned as ``None`` regardless of type so the loader can
    emit SQL NULL.  An empty string that survived NULL-disambiguation is
    preserved as ``""`` for text columns but becomes ``None`` for numeric
    columns (because ``""`` isn't a valid integer / float).
    """
    if value is None:
        return None
    if type_key == "str":
        return value
    stripped = value.strip()
    if stripped == "":
        return None
    if type_key == "int":
        try:
            return int(float(stripped))
        except ValueError:
            return None
    if type_key == "float":
        try:
            return float(stripped)
        except ValueError:
            return None
    return value


def _build_header_mapping(headers: Iterable[str]) -> Dict[int, str]:
    """Return ``{source_index: target_column}`` for every mappable column."""
    mapping: Dict[int, str] = {}
    for idx, header in enumerate(headers):
        target = _map_header(header)
        if target and target in TARGET_COLUMN_NAMES:
            mapping[idx] = target
    return mapping


def _row_to_target_values(
    row: CleanSuccess,
    header_mapping: Dict[int, str],
) -> Tuple[Optional[Dict[str, object]], Optional[str]]:
    """Turn a clean row into a ``{target_col: python_value}`` dict.

    Returns ``(values, None)`` or ``(None, failure_reason)``.
    """
    values: Dict[str, object] = {}
    for idx, raw in enumerate(row.values):
        target_col = header_mapping.get(idx)
        if not target_col:
            continue
        if _is_null_token(raw):
            values[target_col] = None
            continue
        stripped = raw.strip()
        if stripped == "":
            # Genuinely empty: preserve as "" only for text columns.
            type_key = TARGET_TYPES.get(target_col, "str")
            values[target_col] = "" if type_key == "str" else None
            continue
        type_key = TARGET_TYPES.get(target_col, "str")
        values[target_col] = _coerce(stripped, type_key)

    pk_value = values.get(PRIMARY_KEY)
    if pk_value is None or (isinstance(pk_value, str) and pk_value.strip() == ""):
        return None, f"empty_{PRIMARY_KEY}"

    # Normalise PK itself (always str, stripped).
    values[PRIMARY_KEY] = str(pk_value).strip()

    values.setdefault("source_file", row.source_file)
    values.setdefault("ingested_at", datetime.datetime.now().isoformat(timespec="seconds"))
    return values, None


def _merge_values(
    existing: Dict[str, object],
    incoming: Dict[str, object],
) -> None:
    """Merge ``incoming`` into ``existing`` using MERGE_STRATEGY."""
    for col, strategy in MERGE_STRATEGY.items():
        if col not in TARGET_COLUMN_NAMES:
            continue
        cur = existing.get(col)
        new = incoming.get(col)

        if strategy == "sum":
            if cur is None:
                cur_val = 0.0
            elif isinstance(cur, (int, float)):
                cur_val = float(cur)
            else:
                cur_val = 0.0
            if new is None:
                new_val = 0.0
            elif isinstance(new, (int, float)):
                new_val = float(new)
            else:
                new_val = 0.0
            merged: object = cur_val + new_val
            # Preserve int-ness where possible.
            if merged == int(merged):
                merged = int(merged)
            existing[col] = merged
        elif strategy == "first_non_empty":
            if cur is None or cur == "":
                existing[col] = new
        else:  # pragma: no cover - defensive
            if cur is None:
                existing[col] = new

    # Audit columns: keep the first non-empty source_file, always refresh
    # ingested_at so we know when the last contribution was merged.
    if existing.get("source_file") is None or existing.get("source_file") == "":
        existing["source_file"] = incoming.get("source_file")
    existing["ingested_at"] = incoming.get(
        "ingested_at", datetime.datetime.now().isoformat(timespec="seconds")
    )
    for col in TARGET_COLUMN_NAMES:
        if col in existing or col in incoming:
            existing.setdefault(col, incoming.get(col))


def transform_rows(
    cleaned_rows: Iterable[CleanSuccess],
) -> TransformResult:
    """Run the full transform pipeline on a batch of cleaned rows."""
    result = TransformResult()

    # Header mapping is per-file, so group rows by header list first.
    groups: Dict[Tuple[str, ...], Dict[int, str]] = {}
    rows_by_group: Dict[Tuple[str, ...], List[CleanSuccess]] = {}
    for row in cleaned_rows:
        key = tuple(h.lower().strip() for h in row.headers)
        if key not in groups:
            groups[key] = _build_header_mapping(row.headers)
            rows_by_group[key] = []
        rows_by_group[key].append(row)

    # Per-pk accumulator across the whole batch.
    merged: Dict[str, Dict[str, object]] = {}
    # Keep track of the source file/line that produced the winning row so we
    # can emit a single TransformSuccess per PK.
    merged_origin: Dict[str, Tuple[str, int]] = {}

    for key, header_mapping in groups.items():
        for row in rows_by_group[key]:
            target_values, err = _row_to_target_values(row, header_mapping)
            if err or target_values is None:
                result.failures.append(
                    TransformFailure(
                        source_file=row.source_file,
                        source_line=row.source_line,
                        reason=err or "unknown_transform_error",
                        raw=row.raw,
                    )
                )
                continue
            pk = str(target_values[PRIMARY_KEY])
            if pk in merged:
                _merge_values(merged[pk], target_values)
                result.merged_duplicates[pk] = result.merged_duplicates.get(pk, 0) + 1
            else:
                merged[pk] = dict(target_values)
                merged_origin[pk] = (row.source_file, row.source_line)

    # Emit one success per distinct PK, with the merged values.
    for pk, values in merged.items():
        src_file, src_line = merged_origin.get(pk, ("<unknown>", 0))
        # Make sure every target column has an entry so the loader's INSERT
        # can rely on a stable schema.
        complete = {col: values.get(col) for col in TARGET_COLUMN_NAMES}
        result.successes.append(
            TransformSuccess(values=complete, source_file=src_file, source_line=src_line)
        )

    return result


def transform_failure_to_quarantine(failure: TransformFailure) -> QuarantineRecord:
    return QuarantineRecord(
        source_file=failure.source_file,
        source_line=failure.source_line,
        stage="transform",
        reason=failure.reason,
        raw_content=failure.raw,
        encoding=None,
    )


def transform_failures_to_quarantine(
    failures: Iterable[TransformFailure],
) -> List[QuarantineRecord]:
    return [transform_failure_to_quarantine(f) for f in failures]
