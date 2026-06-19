"""Statistics collector and high-level pipeline orchestrator.

``RunStats`` is a plain dataclass that the CLI prints at the end of a run.
It tracks every counter that the user asked to see: files discovered,
successful rows loaded, rows quarantined (failed during clean *or* transform)
and files skipped outright.

``run_pipeline`` wires together extractor -> cleaner -> transformer ->
loader, in one transaction, and returns a populated ``RunStats``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .cleaner import (
    CleanSuccess,
    clean_file,
    failures_to_quarantine as clean_failures_to_quarantine,
)
from .extractor import (
    ExtractionError,
    ExtractedFile,
    list_csv_files,
    extract_file,
)
from .loader import count_target_rows, init_db, load_rows
from .quarantine import QuarantineRecord, QuarantineStore
from .transformer import (
    transform_failures_to_quarantine,
    transform_rows,
)


@dataclass
class RunStats:
    """Summary of a full ETL run, printed by the CLI."""

    files_discovered: int = 0
    files_skipped: int = 0
    files_processed: int = 0
    encoding_used: Dict[str, int] = field(default_factory=dict)

    rows_raw: int = 0
    rows_clean_success: int = 0
    rows_clean_failed: int = 0
    rows_transform_failed: int = 0
    rows_merged_duplicates: int = 0
    rows_loaded: int = 0
    rows_quarantined: int = 0

    per_file: Dict[str, Dict[str, int]] = field(default_factory=dict)
    skipped_files: List[str] = field(default_factory=list)
    quarantine_reasons: Dict[str, int] = field(default_factory=dict)

    target_db: Optional[str] = None
    target_row_count: int = 0
    quarantine_row_count: int = 0

    errors: List[str] = field(default_factory=list)


def _bump(d: Dict[str, int], key: str, n: int = 1) -> None:
    d[key] = d.get(key, 0) + n


def run_pipeline(source: str, target: str, verbose: bool = False) -> RunStats:
    """Execute the full ETL pipeline and return a stats summary.

    The whole run is wrapped in a single SQLite transaction so that either
    all loaded rows *and* all quarantine rows end up in the DB, or neither
    does.
    """
    stats = RunStats(target_db=os.path.abspath(target))

    files = list_csv_files(source)
    stats.files_discovered = len(files)
    if not files:
        stats.errors.append(f"no CSV/TSV files found under {source!r}")
        return stats

    conn = init_db(target)
    qstore = QuarantineStore(conn)
    try:
        conn.execute("BEGIN")
        qstore.init()

        all_clean_rows: List[CleanSuccess] = []
        all_quarantine: List[QuarantineRecord] = []

        for path in files:
            base = os.path.basename(path)
            stats.per_file[base] = {
                "clean_success": 0,
                "clean_failed": 0,
                "transform_failed": 0,
                "loaded": 0,
            }
            extracted, err = extract_file(path)
            if err is not None or extracted is None:
                stats.files_skipped += 1
                stats.skipped_files.append(f"{base}: {err.reason if err else 'unknown'}")
                continue

            stats.files_processed += 1
            _bump(stats.encoding_used, extracted.encoding)

            cleaned = clean_file(extracted)
            stats.rows_raw += len(cleaned.rows) + len(cleaned.failures)
            stats.rows_clean_success += len(cleaned.rows)
            stats.rows_clean_failed += len(cleaned.failures)
            stats.per_file[base]["clean_success"] = len(cleaned.rows)
            stats.per_file[base]["clean_failed"] = len(cleaned.failures)

            all_clean_rows.extend(cleaned.rows)
            for q in clean_failures_to_quarantine(cleaned.failures):
                all_quarantine.append(q)
                _bump(stats.quarantine_reasons, q.reason)

        # Transform all cleaned rows in one go so duplicate-PK merging works
        # across files.
        transformed = transform_rows(all_clean_rows)
        stats.rows_transform_failed = len(transformed.failures)
        stats.rows_merged_duplicates = sum(transformed.merged_duplicates.values())

        for q in transform_failures_to_quarantine(transformed.failures):
            all_quarantine.append(q)
            _bump(stats.quarantine_reasons, q.reason)
            # Attribute transform failures to the file they came from.
            base = os.path.basename(q.source_file) if q.source_file else "<unknown>"
            stats.per_file.setdefault(base, {
                "clean_success": 0, "clean_failed": 0,
                "transform_failed": 0, "loaded": 0,
            })
            stats.per_file[base]["transform_failed"] = (
                stats.per_file[base].get("transform_failed", 0) + 1
            )

        stats.rows_quarantined = len(all_quarantine)

        # Write load data, then quarantine (both in the same transaction).
        loaded = load_rows(conn, transformed.successes)
        stats.rows_loaded = loaded
        written_q = qstore.put_many(all_quarantine)
        assert written_q == stats.rows_quarantined, (
            f"quarantine insert mismatch: {written_q} vs {stats.rows_quarantined}"
        )

        # Attribute loaded rows back to per-file counters.
        for succ in transformed.successes:
            base = os.path.basename(succ.source_file) if succ.source_file else "<unknown>"
            stats.per_file.setdefault(base, {
                "clean_success": 0, "clean_failed": 0,
                "transform_failed": 0, "loaded": 0,
            })
            stats.per_file[base]["loaded"] = stats.per_file[base].get("loaded", 0) + 1

        conn.commit()

        stats.target_row_count = count_target_rows(conn)
        stats.quarantine_row_count = qstore.count()
        return stats

    except Exception as exc:  # pragma: no cover - defensive
        conn.rollback()
        stats.errors.append(f"transaction rolled back: {exc!r}")
        return stats
    finally:
        conn.close()


def format_summary(stats: RunStats) -> str:
    """Pretty-print the summary the CLI shows at the end of a run."""
    lines: List[str] = []
    lines.append("=" * 62)
    lines.append("  ETL PIPELINE RUN SUMMARY")
    lines.append("=" * 62)
    lines.append(f"  Target DB           : {stats.target_db or '-'}")
    lines.append(
        f"  Files               : discovered={stats.files_discovered}  "
        f"processed={stats.files_processed}  skipped={stats.files_skipped}"
    )
    if stats.encoding_used:
        enc_bits = ", ".join(f"{k}={v}" for k, v in sorted(stats.encoding_used.items()))
        lines.append(f"  Encodings detected  : {enc_bits}")
    lines.append("-" * 62)
    lines.append(f"  Rows loaded (OK)    : {stats.rows_loaded}")
    if stats.rows_merged_duplicates:
        lines.append(f"    (incl. {stats.rows_merged_duplicates} duplicate-PK merges)")
    lines.append(
        f"  Rows failed         : {stats.rows_quarantined} "
        f"(clean={stats.rows_clean_failed}, transform={stats.rows_transform_failed})"
    )
    lines.append(f"  Rows skipped        : {stats.files_skipped} file(s)")
    lines.append("-" * 62)
    if stats.quarantine_reasons:
        lines.append("  Top quarantine reasons:")
        for reason, cnt in sorted(
            stats.quarantine_reasons.items(), key=lambda kv: kv[1], reverse=True
        ):
            lines.append(f"    - {reason:<40} {cnt}")
        lines.append("-" * 62)
    lines.append("  Per-file breakdown:")
    for fname, counts in sorted(stats.per_file.items()):
        lines.append(
            f"    {fname:<30} ok={counts.get('loaded', 0):>4}  "
            f"clean_fail={counts.get('clean_failed', 0):>3}  "
            f"tx_fail={counts.get('transform_failed', 0):>3}"
        )
    if stats.skipped_files:
        lines.append("-" * 62)
        lines.append("  Skipped files:")
        for s in stats.skipped_files:
            lines.append(f"    - {s}")
    if stats.errors:
        lines.append("-" * 62)
        lines.append("  Errors:")
        for e in stats.errors:
            lines.append(f"    ! {e}")
    lines.append("=" * 62)
    lines.append(
        f"  Target rows in DB   : {stats.target_row_count}  |  "
        f"Quarantine rows in DB: {stats.quarantine_row_count}"
    )
    lines.append("=" * 62)
    return "\n".join(lines)
