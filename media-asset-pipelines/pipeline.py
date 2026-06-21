#!/usr/bin/env python3
import argparse
import os
import sys
import yaml
from datetime import datetime

from database import Database
from collector import Collector, Asset
from processor import ImageProcessor


def load_config(config_path: str) -> dict:
    if not os.path.isfile(config_path):
        print(f"[ERROR] Config file not found: {config_path}")
        sys.exit(1)
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def cmd_process(args):
    print("=" * 60)
    print(f"  Media Asset Pipeline - Process")
    print(f"  Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    config = load_config(args.config)

    source_dir = os.path.abspath(args.source)
    output_base = os.path.abspath(config.get('output', {}).get('base_dir', './processed-images'))
    db_path = os.path.abspath(config.get('database', {}).get('path', './asset_manifest.db'))
    supported_formats = set(config.get('supported_formats', [
        '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'
    ]))
    variants = config.get('variants', {})

    print(f"[CONFIG] Source directory : {source_dir}")
    print(f"[CONFIG] Output directory : {output_base}")
    print(f"[CONFIG] Database path    : {db_path}")
    print(f"[CONFIG] Variants         : {', '.join(variants.keys())}")
    print(f"[CONFIG] Supported formats: {', '.join(sorted(supported_formats))}")
    print()

    collector = Collector(supported_formats=supported_formats)
    db = Database(db_path)
    processor = ImageProcessor(variants_config=variants, output_base_dir=output_base)

    print("[STEP 1] Scanning directory and computing content hashes...")
    assets = collector.scan_directory(source_dir)
    print(f"         Found {len(assets)} unique image files (after dedup).")
    print()

    if not assets:
        print("[DONE] No images found. Exiting.")
        return

    print("[STEP 2] Checking asset manifest for changes...")
    pending_assets: list[Asset] = []
    skipped = 0

    for asset in assets:
        db.upsert_asset(
            file_path=asset.file_path,
            content_hash=asset.content_hash,
            file_size=asset.file_size,
            last_modified=asset.last_modified
        )

        if db.is_up_to_date(
            file_path=asset.file_path,
            content_hash=asset.content_hash,
            file_size=asset.file_size,
            last_modified=asset.last_modified
        ):
            skipped += 1
            print(f"  [CACHE] {os.path.relpath(asset.file_path, source_dir)}")
        else:
            pending_assets.append(asset)

    print(f"         {len(pending_assets)} need processing, {skipped} already up-to-date.")
    print()

    if not pending_assets:
        print("[DONE] All assets are already processed. Exiting.")
        _print_stats(db)
        return

    print(f"[STEP 3] Processing {len(pending_assets)} assets...")
    success_count = 0
    fail_count = 0

    for idx, asset in enumerate(pending_assets, 1):
        rel_path = os.path.relpath(asset.file_path, source_dir)
        prefix = f"[{idx}/{len(pending_assets)}]"

        try:
            print(f"  {prefix} PROCESSING: {rel_path}")
            results = processor.process_asset(asset)
            db.mark_processed(asset.file_path, results)
            success_count += 1

            for variant_name, out_path in results.items():
                cfg = variants[variant_name]
                print(f"           -> {variant_name} {cfg['width']}x{cfg['height']} : "
                      f"{os.path.relpath(out_path, os.getcwd())}")

        except Exception as e:
            fail_count += 1
            db.mark_failed(asset.file_path, str(e))
            print(f"  {prefix} FAILED: {rel_path}")
            print(f"           Error: {e}")

    print()
    print("=" * 60)
    print(f"  Processing complete.")
    print(f"  Success: {success_count}  Failed: {fail_count}  Cached: {skipped}")
    print(f"  Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    _print_stats(db)


def cmd_status(args):
    config = load_config(args.config)
    db_path = os.path.abspath(config.get('database', {}).get('path', './asset_manifest.db'))
    db = Database(db_path)
    _print_stats(db)


def _print_stats(db: Database):
    stats = db.get_stats()
    print()
    print("Asset Manifest Statistics:")
    for status in ('processed', 'pending', 'failed'):
        count = stats.get(status, 0)
        print(f"  {status:10s}: {count}")
    total = sum(stats.values())
    print(f"  {'total':10s}: {total}")


def main():
    parser = argparse.ArgumentParser(
        prog='pipeline.py',
        description='Media Asset Batch Processing Pipeline'
    )
    subparsers = parser.add_subparsers(dest='command', required=True)

    process_parser = subparsers.add_parser('process', help='Process images in a directory')
    process_parser.add_argument('source', help='Source directory containing images')
    process_parser.add_argument('--config', required=True, help='Path to YAML config file')
    process_parser.set_defaults(func=cmd_process)

    status_parser = subparsers.add_parser('status', help='Show processing statistics')
    status_parser.add_argument('--config', required=True, help='Path to YAML config file')
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
