import os
import hashlib
from dataclasses import dataclass, field
from typing import List, Set


@dataclass
class Asset:
    file_path: str
    content_hash: str
    file_size: int
    last_modified: float


@dataclass
class Collector:
    supported_formats: Set[str] = field(default_factory=lambda: {
        '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'
    })

    @staticmethod
    def compute_hash(file_path: str, chunk_size: int = 8192) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                sha256.update(chunk)
        return sha256.hexdigest()

    def scan_directory(self, root_dir: str) -> List[Asset]:
        if not os.path.isdir(root_dir):
            raise ValueError(f"Directory not found: {root_dir}")

        assets: List[Asset] = []
        seen_hashes: Set[str] = set()

        for dirpath, _dirnames, filenames in os.walk(root_dir):
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in self.supported_formats:
                    continue

                file_path = os.path.join(dirpath, filename)
                try:
                    stat = os.stat(file_path)
                    content_hash = self.compute_hash(file_path)

                    if content_hash in seen_hashes:
                        print(f"  [SKIP] Duplicate (by hash): {file_path}")
                        continue

                    seen_hashes.add(content_hash)
                    assets.append(Asset(
                        file_path=file_path,
                        content_hash=content_hash,
                        file_size=stat.st_size,
                        last_modified=stat.st_mtime
                    ))
                except (OSError, IOError) as e:
                    print(f"  [WARN] Cannot read {file_path}: {e}")

        return assets
