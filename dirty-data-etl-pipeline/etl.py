#!/usr/bin/env python3
"""Command-line entry point for the dirty-data fault-tolerant ETL pipeline.

Usage::

    python etl.py run --source ./raw/ --target data.db
    python etl.py run --source ./raw/ --target data.db --verbose
    python etl.py --help
    python etl.py run --help
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import List, Optional

from etl_pipeline.pipeline import format_summary, run_pipeline


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="etl",
        description=(
            "Dirty-data fault-tolerant ETL pipeline.  "
            "Reads mixed-encoding CSV files, cleans them, "
            "routes parse failures to a quarantine table, and loads "
            "normalised rows into a SQLite database."
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser(
        "run",
        help="Run the ETL pipeline.",
    )
    p_run.add_argument(
        "--source",
        required=True,
        help="Path to a source CSV/TSV file or a directory to scan recursively.",
    )
    p_run.add_argument(
        "--target",
        required=True,
        help="Path to the target SQLite database (created if it does not exist).",
    )
    p_run.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print extra progress info.",
    )
    return parser


def cmd_run(args: argparse.Namespace) -> int:
    source = args.source
    target = args.target

    if not os.path.exists(source):
        print(f"[etl] error: source path does not exist: {source}", file=sys.stderr)
        return 2

    if args.verbose:
        print(f"[etl] extracting from: {os.path.abspath(source)}")
        print(f"[etl] loading into   : {os.path.abspath(target)}")

    stats = run_pipeline(source=source, target=target, verbose=args.verbose)

    print()
    print(format_summary(stats))

    # Exit code 0 when we loaded *something* (or were just asked to process
    # an empty set and produced no failures), otherwise 1 so CI can tell a
    # run that produced failures apart from a clean one.
    if stats.errors:
        return 1
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.command == "run":
        return cmd_run(args)
    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
