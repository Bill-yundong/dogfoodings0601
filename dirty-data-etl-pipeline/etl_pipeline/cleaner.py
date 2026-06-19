"""Cleaning layer: turn decoded text into a stream of normalised row dicts.

The default library ``csv.reader`` is almost good enough, but it gives us no
way to know which physical lines a logical row began on -- and that line
number is exactly what we have to record in the quarantine queue for an
operator to later find the offending line in the original file.

So this module ships a tiny CSV **state-machine parser** that walks the input
character by character.  It keeps a running counter of physical ``\n`` bytes
seen so far.  Whenever a parse error is observed (a ``"`` appearing in the
middle of an unquoted field, a stray unmatched quote at end-of-record, a
mismatched field count) the parser emits a :class:`CleanFailure` and --
crucially -- *keeps going* on the next logical row, so one bad line never
poisons the rest of the file.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Sequence, Tuple

from .extractor import ExtractedFile
from .quarantine import QuarantineRecord


@dataclass
class CleanSuccess:
    """A row that parsed cleanly enough to hand to the transformer."""

    source_file: str
    source_line: int
    encoding: str
    headers: List[str]
    values: List[str]
    raw: str


@dataclass
class CleanFailure:
    """A row that could not be parsed cleanly; destined for the quarantine."""

    source_file: str
    source_line: int
    encoding: str
    reason: str
    raw: str


CleanResult = Tuple[Optional[CleanSuccess], Optional[CleanFailure]]


@dataclass
class CleanFileResult:
    """Everything produced by cleaning a single file."""

    headers: Optional[List[str]]
    rows: List[CleanSuccess] = field(default_factory=list)
    failures: List[CleanFailure] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 1. Robust CSV parser: state-machine, line-number aware, fault-tolerant.
# ---------------------------------------------------------------------------

def _split_physical_lines(text: str) -> List[str]:
    """Split on ``\r\n``, ``\r`` or ``\n`` but *keep* trailing delimiter.

    Preserving the delimiter means we can correctly recombine a logical row
    that spans multiple physical lines (embedded newline inside quotes) for
    the quarantine record.
    """
    out: List[str] = []
    buf: List[str] = []
    for ch in text:
        buf.append(ch)
        if ch == "\n":
            out.append("".join(buf))
            buf = []
        elif ch == "\r":
            pass
    if buf:
        out.append("".join(buf))
    # "\r" cleanup: right-strip lone \r from each line.
    return [ln.rstrip("\r") if ln.endswith("\r\n") else ln for ln in out]


def _normalise(text: str) -> str:
    """Collapse the various line endings we might have decoded into \n."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def parse_csv_rows(text: str) -> List[Tuple[int, str, List[str], Optional[str]]]:
    """Parse decoded CSV text.

    Returns a list of ``(start_line, raw_row_text, values, error_or_None)``.
    ``start_line`` is **1-based** and refers to the physical line where the
    logical row started in the original file.  ``values`` is always a list
    (possibly empty when parsing completely failed); ``error_or_None`` is a
    short string explaining the failure when one occurred.
    """
    text = _normalise(text)
    records: List[Tuple[int, str, List[str], Optional[str]]] = []

    i = 0
    n = len(text)
    line_no = 1

    while i < n:
        start_line = line_no
        start_i = i
        values: List[str] = []
        field_chars: List[str] = []
        in_quotes = False
        error: Optional[str] = None
        record_done = False

        # Consume exactly one logical record.
        while i < n and not record_done:
            ch = text[i]

            if ch == "\n":
                line_no += 1
                if in_quotes:
                    # Embedded newline inside a quoted field: valid CSV.
                    field_chars.append(ch)
                    i += 1
                    continue
                # End of record.
                record_done = True
                values.append("".join(field_chars))
                field_chars = []
                i += 1
                continue

            if ch == '"':
                if not in_quotes:
                    # A quote at the very start of a field?
                    if not field_chars:
                        in_quotes = True
                        i += 1
                        continue
                    # Otherwise a stray quote inside an unquoted field.
                    # Try to recover: treat it as literal and keep going,
                    # but tag the row as suspicious.
                    error = error or "unexpected_quote_in_unquoted_field"
                    field_chars.append(ch)
                    i += 1
                    continue

                # Inside quoted field: could be escaped "" or closing ".
                if i + 1 < n and text[i + 1] == '"':
                    field_chars.append('"')
                    i += 2
                    continue
                # Closing quote.
                in_quotes = False
                i += 1
                continue

            if ch == "," and not in_quotes:
                values.append("".join(field_chars))
                field_chars = []
                i += 1
                continue

            field_chars.append(ch)
            i += 1

        # End of input OR end of record.
        if not record_done:
            # We exited because we reached EOF.
            values.append("".join(field_chars))
            field_chars = []
        if in_quotes:
            error = error or "unterminated_quoted_field"

        raw_row_text = text[start_i:i].rstrip("\n")

        # Drop completely empty trailing records (e.g. final \n).
        if not raw_row_text and not values:
            continue
        if len(values) == 1 and values[0] == "" and not raw_row_text:
            continue

        records.append((start_line, raw_row_text, values, error))

    return records


# ---------------------------------------------------------------------------
# 2. High-level cleaner: headers, field-count enforcement, quarantine routing.
# ---------------------------------------------------------------------------

def _try_parse_with_stdlib(text: str) -> Tuple[Optional[List[str]], Optional[str]]:
    """Use stdlib ``csv.reader`` *only* for header sniffing."""
    try:
        reader = csv.reader(io.StringIO(text))
        first = next(reader)
        return first, None
    except Exception as exc:
        return None, f"stdlib_csv: {exc}"


def clean_file(
    extracted: ExtractedFile,
) -> CleanFileResult:
    """Parse a decoded file into successes and failures.

    Steps:
      * parse header row (must be first logical row of the file)
      * for every subsequent logical row:
          - field count matches header -> :class:`CleanSuccess`
          - field count differs, or row flagged by parser ->
            :class:`CleanFailure` routed to quarantine
    """
    result = CleanFileResult(headers=None)

    records = parse_csv_rows(extracted.text)
    if not records:
        return result

    # First non-empty logical record is the header.
    header_line, header_raw, header_values, header_err = records[0]
    if header_err:
        # If even the header is malformed, try the stdlib reader as a
        # last-ditch fallback.  If *that* also fails, quarantine every row.
        alt_headers, _alt_err = _try_parse_with_stdlib(extracted.text)
        if alt_headers:
            headers = [h.strip() for h in alt_headers]
        else:
            headers = [h.strip() for h in header_values] or ["col1"]
            result.failures.append(
                CleanFailure(
                    source_file=extracted.path,
                    source_line=header_line,
                    encoding=extracted.encoding,
                    reason=f"header_malformed:{header_err}",
                    raw=header_raw,
                )
            )
    else:
        headers = [h.strip() for h in header_values]

    # An empty header should never happen but be defensive.
    if not headers:
        headers = ["col1"]

    result.headers = headers
    expected_fields = len(headers)

    for start_line, raw, values, parse_err in records[1:]:
        # Treat completely blank rows as "skipped" (not a failure, not a row).
        if not raw.strip() and (not values or all(v == "" for v in values)):
            continue

        if parse_err:
            result.failures.append(
                CleanFailure(
                    source_file=extracted.path,
                    source_line=start_line,
                    encoding=extracted.encoding,
                    reason=parse_err,
                    raw=raw,
                )
            )
            continue

        if len(values) != expected_fields:
            # Half-quote / stray comma: could not align fields.
            result.failures.append(
                CleanFailure(
                    source_file=extracted.path,
                    source_line=start_line,
                    encoding=extracted.encoding,
                    reason=f"field_count_mismatch:{len(values)}_vs_{expected_fields}",
                    raw=raw,
                )
            )
            continue

        result.rows.append(
            CleanSuccess(
                source_file=extracted.path,
                source_line=start_line,
                encoding=extracted.encoding,
                headers=headers,
                values=values,
                raw=raw,
            )
        )

    return result


def failure_to_quarantine(failure: CleanFailure) -> QuarantineRecord:
    return QuarantineRecord(
        source_file=failure.source_file,
        source_line=failure.source_line,
        stage="clean",
        reason=failure.reason,
        raw_content=failure.raw,
        encoding=failure.encoding,
    )


def failures_to_quarantine(failures: Iterable[CleanFailure]) -> List[QuarantineRecord]:
    return [failure_to_quarantine(f) for f in failures]
