import os
import time
from PIL import Image
import pytest

from collector import Collector


def make_image(path, size=(800, 600), color=(255, 0, 0)):
    img = Image.new('RGB', size, color)
    img.save(path)


class TestCollector:
    def test_hash_dedup(self, tmp_path):
        make_image(tmp_path / "a.jpg")
        make_image(tmp_path / "b.jpg")
        make_image(tmp_path / "c.jpg", color=(0, 255, 0))
        (tmp_path / "sub").mkdir()
        make_image(tmp_path / "sub" / "duplicate.jpg")

        collector = Collector()
        assets = collector.scan_directory(str(tmp_path))

        assert len(assets) == 2
        hashes = {a.content_hash for a in assets}
        assert len(hashes) == 2

    def test_format_filter(self, tmp_path):
        make_image(tmp_path / "ok.jpg")
        make_image(tmp_path / "ok.png")
        (tmp_path / "skip.txt").write_text("not an image")
        (tmp_path / "skip.gif").write_bytes(b"fake gif")
        (tmp_path / "skip.pdf").write_bytes(b"fake pdf")
        (tmp_path / "sub").mkdir()
        (tmp_path / "sub" / "skip.md").write_text("markdown")

        collector = Collector(supported_formats={'.jpg', '.png'})
        assets = collector.scan_directory(str(tmp_path))

        names = sorted(os.path.basename(a.file_path) for a in assets)
        assert names == ["ok.jpg", "ok.png"]

    def test_compute_hash_consistent(self, tmp_path):
        p = tmp_path / "test.jpg"
        make_image(p)
        h1 = Collector.compute_hash(str(p))
        h2 = Collector.compute_hash(str(p))
        assert h1 == h2
        assert len(h1) == 64

    def test_scan_nonexistent_directory(self):
        collector = Collector()
        with pytest.raises(ValueError, match="Directory not found"):
            collector.scan_directory("/nonexistent/path")

    def test_different_content_different_hash(self, tmp_path):
        p1 = tmp_path / "p1.jpg"
        p2 = tmp_path / "p2.jpg"
        make_image(p1, color=(255, 0, 0))
        make_image(p2, color=(0, 255, 0))
        h1 = Collector.compute_hash(str(p1))
        h2 = Collector.compute_hash(str(p2))
        assert h1 != h2

    def test_asset_fields(self, tmp_path):
        p = tmp_path / "test.jpg"
        make_image(p)
        collector = Collector()
        assets = collector.scan_directory(str(tmp_path))
        assert len(assets) == 1
        a = assets[0]
        assert a.file_path == str(p)
        assert a.file_size > 0
        assert 0 < a.last_modified <= time.time()
