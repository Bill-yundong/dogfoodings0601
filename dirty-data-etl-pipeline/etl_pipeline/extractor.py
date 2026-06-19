"""Extraction layer: locate source CSV files, auto-detect their encoding and
normalise the raw bytes into a Python ``str``.

The encoding detector is dependency-free by default and works in three
stages:

1. BOM sniffing (handles UTF-8-SIG and UTF-16).
2. Optional ``chardet`` statistical detection, used only when the library is
   importable *and* reports high confidence.
3. A strict-decode fallback that tries UTF-8 -> GBK -> Latin-1 in order.  UTF-8
   is tried first because its multi-byte grammar is extremely strict and a
   genuine GBK/Latin-1 file will almost never decode as valid UTF-8.  GBK is
   only trusted when the decoded text actually contains CJK characters,
   otherwise we fall through to Latin-1 (which can never fail, one byte maps
   to one code point).

Stage 3 is what makes the pipeline resilient on a machine without ``chardet``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterator, List, Optional, Tuple

CSV_GLOBS = ("*.csv", "*.CSV", "*.tsv")


@dataclass
class ExtractedFile:
    """A single source file after encoding has been resolved."""

    path: str
    encoding: str
    method: str
    text: str
    byte_size: int


@dataclass
class ExtractionError:
    """A file that could not be read at all (counted as skipped)."""

    path: str
    reason: str


# Unicode ranges that indicate the decoded text really is CJK, used to avoid
# trusting GBK when it accidentally decodes Latin-1 noise.
_CJK_RANGES: Tuple[Tuple[int, int], ...] = (
    (0x4E00, 0x9FFF),   # CJK Unified Ideographs
    (0x3400, 0x4DBF),   # CJK Extension A
    (0x3000, 0x303F),   # CJK symbols and punctuation
    (0xFF00, 0xFFEF),   # Halfwidth and Fullwidth Forms
)


def _has_cjk(text: str, limit: int = 65536) -> bool:
    sample = text[:limit]
    for ch in sample:
        cp = ord(ch)
        for lo, hi in _CJK_RANGES:
            if lo <= cp <= hi:
                return True
    return False


def _canon(encoding: str) -> str:
    """Normalise the spelling of an encoding name returned by chardet."""
    enc = (encoding or "").strip().lower().replace("_", "-")
    aliases = {
        "ascii": "ascii",
        "utf-8": "utf-8",
        "utf-8-sig": "utf-8-sig",
        "gb2312": "gbk",
        "gbk": "gbk",
        "gb18030": "gbk",
        "iso-8859-1": "latin-1",
        "iso8859-1": "latin-1",
        "latin-1": "latin-1",
        "latin1": "latin-1",
        "windows-1252": "latin-1",
    }
    return aliases.get(enc, enc)


def detect_encoding(raw: bytes) -> Tuple[str, str]:
    """Return ``(encoding, method)`` describing how the encoding was chosen.

    ``method`` is a short human readable tag (``bom``, ``chardet``,
    ``strict``, ``strict+cjk`` or ``fallback``) that the cleaner records when
    a row has to be quarantined, so operators can see *why* an encoding was
    picked.
    """

    if raw[:3] == b"\xef\xbb\xbf":
        return "utf-8-sig", "bom"
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return "utf-16", "bom"

    # Optional statistical detector.
    try:  # pragma: no cover - exercised only when chardet is installed
        import chardet  # type: ignore

        det = chardet.detect(raw)
        enc = _canon(det.get("encoding") or "")
        confidence = float(det.get("confidence") or 0.0)
        if enc and confidence >= 0.7:
            if enc == "ascii":
                return "utf-8", "chardet"  # ascii is a utf-8 subset
            return enc, "chardet"
    except Exception:
        pass

    # Strict fallback: UTF-8 first (strictest grammar).
    try:
        raw.decode("utf-8")
        return "utf-8", "strict"
    except UnicodeDecodeError:
        pass

    # GBK only when it actually decodes *and* the result contains CJK.
    try:
        decoded = raw.decode("gbk")
        if _has_cjk(decoded):
            return "gbk", "strict+cjk"
    except UnicodeDecodeError:
        pass

    # Latin-1 never raises; it is the ultimate safety net.
    return "latin-1", "fallback"


def decode_bytes(raw: bytes) -> Tuple[str, str]:
    """Detect the encoding and return ``(text, encoding)``."""
    encoding, _method = detect_encoding(raw)
    if encoding in ("utf-16", "utf-16-le", "utf-16-be"):
        text = raw.decode("utf-16", errors="replace")
    elif encoding == "utf-8-sig":
        text = raw.decode("utf-8-sig")
    else:
        text = raw.decode(encoding, errors="replace")
    return text, encoding


def list_csv_files(source: str) -> List[str]:
    """Return sorted CSV file paths found under ``source`` (file or dir)."""
    if os.path.isfile(source):
        return [source]
    files: List[str] = []
    for root, _dirs, names in os.walk(source):
        for name in names:
            if name.lower().endswith((".csv", ".tsv")):
                files.append(os.path.join(root, name))
    return sorted(files)


def extract_file(path: str) -> Tuple[Optional[ExtractedFile], Optional[ExtractionError]]:
    """Read one file, detect its encoding and decode to text.

    Returns ``(ExtractedFile, None)`` on success or ``(None, ExtractionError)``
    when the file cannot be opened / is empty (these are treated as skipped).
    """
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError as exc:
        return None, ExtractionError(path, f"open failed: {exc}")

    if not raw.strip():
        return None, ExtractionError(path, "empty file")

    text, encoding = decode_bytes(raw)
    method = detect_encoding(raw)[1]
    return (
        ExtractedFile(
            path=path,
            encoding=encoding,
            method=method,
            text=text,
            byte_size=len(raw),
        ),
        None,
    )


def iter_extracted(source: str) -> Iterator[Tuple[Optional[ExtractedFile], Optional[ExtractionError]]]:
    """Yield extraction results for every CSV under ``source``."""
    for path in list_csv_files(source):
        yield extract_file(path)
