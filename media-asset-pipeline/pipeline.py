#!/usr/bin/env python3
import argparse
import hashlib
import logging
import os
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml
from PIL import Image, ImageOps

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"}


@dataclass
class VariantSpec:
    name: str
    width: int
    height: int
    fit: str
    quality: int
    format: str


@dataclass
class AssetRecord:
    file_path: str
    content_hash: str
    file_size: int
    mtime: float
    status: str


class SQLiteStore:
    def __init__(self, db_path: str = "./pipeline.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS asset_manifest (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL UNIQUE,
                    content_hash TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    mtime REAL NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_content_hash ON asset_manifest(content_hash)"
            )
            conn.commit()

    def get_record(self, file_path: str) -> Optional[AssetRecord]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM asset_manifest WHERE file_path = ?", (file_path,)
            ).fetchone()
            if row:
                return AssetRecord(
                    file_path=row["file_path"],
                    content_hash=row["content_hash"],
                    file_size=row["file_size"],
                    mtime=row["mtime"],
                    status=row["status"],
                )
            return None

    def get_all_hashes(self) -> set:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT content_hash FROM asset_manifest WHERE status = 'processed'"
            ).fetchall()
            return {row["content_hash"] for row in rows}

    def upsert_record(self, record: AssetRecord) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO asset_manifest (file_path, content_hash, file_size, mtime, status, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(file_path) DO UPDATE SET
                    content_hash = excluded.content_hash,
                    file_size = excluded.file_size,
                    mtime = excluded.mtime,
                    status = excluded.status,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    record.file_path,
                    record.content_hash,
                    record.file_size,
                    record.mtime,
                    record.status,
                ),
            )
            conn.commit()

    def mark_processed(self, file_path: str) -> None:
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE asset_manifest SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE file_path = ?",
                (file_path,),
            )
            conn.commit()


class Collector:
    @staticmethod
    def scan_directory(root_dir: str) -> List[Path]:
        root = Path(root_dir)
        if not root.exists():
            raise FileNotFoundError(f"Directory not found: {root_dir}")
        if not root.is_dir():
            raise NotADirectoryError(f"Not a directory: {root_dir}")

        images: List[Path] = []
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                images.append(path)
        logger.info(f"Collector found {len(images)} image files")
        return sorted(images)


class Deduplicator:
    @staticmethod
    def compute_content_hash(file_path: Path) -> str:
        h = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def filter_new_or_changed(
        file_paths: List[Path], store: SQLiteStore
    ) -> List[Tuple[Path, str]]:
        known_hashes = store.get_all_hashes()
        to_process: List[Tuple[Path, str]] = []

        for path in file_paths:
            stat = path.stat()
            content_hash = Deduplicator.compute_content_hash(path)
            existing = store.get_record(str(path))

            needs_processing = False
            if existing is None:
                needs_processing = True
                logger.debug(f"New file: {path}")
            elif (
                existing.content_hash != content_hash
                or existing.file_size != stat.st_size
                or abs(existing.mtime - stat.st_mtime) > 1.0
            ):
                needs_processing = True
                logger.debug(f"Changed file: {path}")
            elif existing.status != "processed":
                needs_processing = True
                logger.debug(f"Unprocessed file: {path}")

            if needs_processing:
                if content_hash in known_hashes:
                    logger.info(
                        f"Duplicate content detected, skipping: {path} (hash already processed)"
                    )
                else:
                    to_process.append((path, content_hash))
                    known_hashes.add(content_hash)

        logger.info(
            f"Deduplication complete: {len(to_process)} files to process, "
            f"{len(file_paths) - len(to_process)} skipped (duplicate/unchanged)"
        )
        return to_process


class ProcessingEngine:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.variants = self._parse_variants()
        self.output_root = Path(self.config.get("output_root", "./processed"))

    @staticmethod
    def _load_config(config_path: str) -> Dict:
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file not found: {config_path}")
        with open(config_path, "r") as f:
            return yaml.safe_load(f)

    def _parse_variants(self) -> List[VariantSpec]:
        variants_config = self.config.get("variants", {})
        variants: List[VariantSpec] = []
        for name, spec in variants_config.items():
            variants.append(
                VariantSpec(
                    name=name,
                    width=int(spec["width"]),
                    height=int(spec["height"]),
                    fit=spec.get("fit", "contain"),
                    quality=int(spec.get("quality", 90)),
                    format=spec.get("format", "jpg").lower(),
                )
            )
        return variants

    def process_image(
        self, src_path: Path, content_hash: str, store: SQLiteStore
    ) -> Dict[str, Path]:
        logger.info(f"Processing: {src_path}")
        stat = src_path.stat()
        record = AssetRecord(
            file_path=str(src_path),
            content_hash=content_hash,
            file_size=stat.st_size,
            mtime=stat.st_mtime,
            status="processing",
        )
        store.upsert_record(record)

        output_paths: Dict[str, Path] = {}
        try:
            with Image.open(src_path) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")

                file_stem = src_path.stem
                for variant in self.variants:
                    variant_dir = self.output_root / variant.name
                    variant_dir.mkdir(parents=True, exist_ok=True)

                    processed = self._apply_variant(img, variant)
                    ext = "jpg" if variant.format in ("jpg", "jpeg") else variant.format
                    out_path = variant_dir / f"{file_stem}.{ext}"
                    self._save_image(processed, out_path, variant)
                    output_paths[variant.name] = out_path
                    logger.info(
                        f"  → {variant.name}: {out_path} "
                        f"({processed.width}x{processed.height})"
                    )

            store.mark_processed(str(src_path))
            return output_paths

        except Exception as e:
            logger.error(f"Failed to process {src_path}: {e}")
            raise

    def _apply_variant(self, img: Image.Image, spec: VariantSpec) -> Image.Image:
        if spec.fit == "cover":
            return ImageOps.fit(
                img,
                (spec.width, spec.height),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
        elif spec.fit == "contain":
            result = img.copy()
            result.thumbnail((spec.width, spec.height), Image.Resampling.LANCZOS)
            return result
        else:
            raise ValueError(f"Unknown fit mode: {spec.fit}")

    def _save_image(self, img: Image.Image, path: Path, spec: VariantSpec) -> None:
        save_kwargs = {"quality": spec.quality, "optimize": True}
        if spec.format in ("jpg", "jpeg"):
            save_kwargs["progressive"] = True
            img.save(path, "JPEG", **save_kwargs)
        elif spec.format == "png":
            img.save(path, "PNG", optimize=True)
        elif spec.format == "webp":
            img.save(path, "WEBP", **save_kwargs)
        else:
            img.save(path, **save_kwargs)


def process_command(args: argparse.Namespace) -> int:
    input_dir = args.directory
    config_path = args.config

    logger.info("=" * 60)
    logger.info("Media Asset Pipeline - Processing Start")
    logger.info("=" * 60)
    logger.info(f"Input directory: {input_dir}")
    logger.info(f"Config file: {config_path}")

    store = SQLiteStore()
    engine = ProcessingEngine(config_path)

    logger.info(f"Output root: {engine.output_root.resolve()}")
    logger.info(f"Variants: {', '.join(v.name for v in engine.variants)}")
    logger.info("-" * 60)

    try:
        file_paths = Collector.scan_directory(input_dir)
    except (FileNotFoundError, NotADirectoryError) as e:
        logger.error(str(e))
        return 1

    if not file_paths:
        logger.warning("No image files found in the directory")
        return 0

    to_process = Deduplicator.filter_new_or_changed(file_paths, store)

    if not to_process:
        logger.info("All files are already processed and unchanged. Nothing to do.")
        logger.info("=" * 60)
        return 0

    logger.info("-" * 60)
    logger.info(f"Starting processing of {len(to_process)} files...")
    logger.info("-" * 60)

    success_count = 0
    fail_count = 0

    for src_path, content_hash in to_process:
        try:
            engine.process_image(src_path, content_hash, store)
            success_count += 1
        except Exception as e:
            logger.error(f"Processing failed for {src_path}: {e}")
            fail_count += 1

    logger.info("-" * 60)
    logger.info("Processing Summary:")
    logger.info(f"  Total images found: {len(file_paths)}")
    logger.info(f"  Files to process: {len(to_process)}")
    logger.info(f"  Successfully processed: {success_count}")
    logger.info(f"  Failed: {fail_count}")
    logger.info(f"  Output directory: {engine.output_root.resolve()}")
    logger.info("=" * 60)

    return 0 if fail_count == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Media Asset Batch Processing Pipeline"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    process_parser = subparsers.add_parser("process", help="Process images in a directory")
    process_parser.add_argument(
        "directory", type=str, help="Directory containing images to process"
    )
    process_parser.add_argument(
        "--config",
        type=str,
        default="resize.yaml",
        help="Path to YAML configuration file (default: resize.yaml)",
    )

    args = parser.parse_args()

    if args.command == "process":
        return process_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
