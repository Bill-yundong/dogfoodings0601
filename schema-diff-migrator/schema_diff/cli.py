import argparse
import json
import os
import sys
from datetime import datetime, timezone

from .snapshot import Snapshot
from .differ import Differ
from .migration import MigrationGenerator


def cmd_snapshot(args: argparse.Namespace) -> int:
    if not os.path.isfile(args.db_path):
        print(f"Error: Database file not found: {args.db_path}", file=sys.stderr)
        return 1

    snapshot = Snapshot(args.db_path)
    data = snapshot.take()

    if args.output:
        out_path = args.output
    else:
        base = os.path.splitext(os.path.basename(args.db_path))[0]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = f"{base}_snapshot_{timestamp}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Snapshot saved to: {out_path}")
    print(f"  Tables: {len(data['tables'])}")
    print(f"  Indices: {len(data['indices'])}")
    return 0


def cmd_migrate(args: argparse.Namespace) -> int:
    for path in [args.old_snapshot, args.new_snapshot]:
        if not os.path.isfile(path):
            print(f"Error: File not found: {path}", file=sys.stderr)
            return 1

    with open(args.old_snapshot, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(args.new_snapshot, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    differ = Differ(old_data, new_data)
    diff_result = differ.diff()

    generator = MigrationGenerator(diff_result)
    statements = generator.generate()

    output_lines = [
        "-- Schema Diff Migration",
        f"-- Source: {os.path.basename(args.old_snapshot)} -> {os.path.basename(args.new_snapshot)}",
        f"-- Generated: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}",
        f"-- Statements: {len(statements)}",
        "",
    ]
    output_lines.extend(statements)
    output_text = "\n".join(output_lines) + ("\n" if output_lines else "")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_text)
        print(f"Migration SQL saved to: {args.output}")
        print(f"  Statements: {len(statements)}")
    else:
        print(output_text, end="")

    return 0


def cmd_diff(args: argparse.Namespace) -> int:
    for path in [args.old_snapshot, args.new_snapshot]:
        if not os.path.isfile(path):
            print(f"Error: File not found: {path}", file=sys.stderr)
            return 1

    with open(args.old_snapshot, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(args.new_snapshot, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    differ = Differ(old_data, new_data)
    diff_result = differ.diff()

    tables = diff_result.get("tables", {})
    indices = diff_result.get("indices", {})

    print("=== Schema Diff Report ===")
    print(f"Tables added:   {len(tables.get('added', {}))}")
    print(f"Tables removed: {len(tables.get('removed', {}))}")
    print(f"Tables modified:{len(tables.get('modified', {}))}")
    print(f"Indices added:  {len(indices.get('added', {}))}")
    print(f"Indices removed:{len(indices.get('removed', {}))}")
    print(f"Indices modified:{len(indices.get('modified', {}))}")
    print()

    for name in tables.get("added", {}):
        print(f"+ ADD TABLE: {name}")
    for name in tables.get("removed", {}):
        print(f"- DROP TABLE: {name}")
    for name, changes in tables.get("modified", {}).items():
        print(f"~ MODIFY TABLE: {name}")
        for change_type, detail in changes.items():
            print(f"    {change_type}: {json.dumps(detail, ensure_ascii=False)}")
    for name in indices.get("added", {}):
        print(f"+ ADD INDEX: {name}")
    for name in indices.get("removed", {}):
        print(f"- DROP INDEX: {name}")
    for name in indices.get("modified", {}):
        print(f"~ MODIFY INDEX: {name}")

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="schema_diff",
        description="SQLite schema snapshot, diff, and migration SQL generator",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    snap_parser = subparsers.add_parser("snapshot", help="Take a schema snapshot of a SQLite database")
    snap_parser.add_argument("db_path", help="Path to the SQLite database file")
    snap_parser.add_argument("-o", "--output", help="Output JSON file path")
    snap_parser.set_defaults(func=cmd_snapshot)

    mig_parser = subparsers.add_parser("migrate", help="Generate migration SQL between two snapshots")
    mig_parser.add_argument("old_snapshot", help="Old snapshot JSON file")
    mig_parser.add_argument("new_snapshot", help="New snapshot JSON file")
    mig_parser.add_argument("-o", "--output", help="Output SQL file path")
    mig_parser.set_defaults(func=cmd_migrate)

    diff_parser = subparsers.add_parser("diff", help="Show a human-readable diff between two snapshots")
    diff_parser.add_argument("old_snapshot", help="Old snapshot JSON file")
    diff_parser.add_argument("new_snapshot", help="New snapshot JSON file")
    diff_parser.set_defaults(func=cmd_diff)

    return parser


def main(argv: list | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)
