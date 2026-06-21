import os
import time
from PIL import Image
import pytest

from database import Database


def make_image(path, size=(800, 600), color=(255, 0, 0)):
    img = Image.new('RGB', size, color)
    img.save(path)


class TestDatabase:
    def test_upsert_asset_hash_change_resets_status(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp = str(tmp_path / "test.jpg")
        make_image(fp, color=(255, 0, 0))

        stat = os.stat(fp)
        db.upsert_asset(fp, "hash_v1", stat.st_size, stat.st_mtime)
        db.mark_processed(fp, {
            'thumbnail': '/tmp/thumb.jpg',
            'medium': '/tmp/medium.jpg',
            'large': '/tmp/large.jpg'
        })
        rec = db.get_record_by_path(fp)
        assert rec['status'] == 'processed'
        assert rec['content_hash'] == 'hash_v1'

        time.sleep(0.1)
        make_image(fp, color=(0, 255, 0))
        stat2 = os.stat(fp)
        db.upsert_asset(fp, "hash_v2", stat2.st_size, stat2.st_mtime)

        rec2 = db.get_record_by_path(fp)
        assert rec2['status'] == 'pending'
        assert rec2['content_hash'] == 'hash_v2'
        assert rec2['thumbnail_path'] is None
        assert rec2['medium_path'] is None
        assert rec2['large_path'] is None

    def test_upsert_asset_touch_no_hash_change_preserves_status(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp = str(tmp_path / "test.jpg")
        make_image(fp)

        stat = os.stat(fp)
        db.upsert_asset(fp, "hash_fixed", stat.st_size, stat.st_mtime)
        db.mark_processed(fp, {
            'thumbnail': '/tmp/thumb.jpg',
            'medium': '/tmp/medium.jpg',
            'large': '/tmp/large.jpg'
        })
        rec = db.get_record_by_path(fp)
        assert rec['status'] == 'processed'

        new_mtime = stat.st_mtime + 100
        new_size = stat.st_size + 1
        db.upsert_asset(fp, "hash_fixed", new_size, new_mtime)

        rec2 = db.get_record_by_path(fp)
        assert rec2['status'] == 'processed'
        assert rec2['file_size'] == new_size
        assert rec2['last_modified'] == new_mtime
        assert rec2['thumbnail_path'] == '/tmp/thumb.jpg'

    def test_is_up_to_date_variant_missing_returns_false(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp = str(tmp_path / "test.jpg")
        make_image(fp)
        stat = os.stat(fp)

        db.upsert_asset(fp, "abc123", stat.st_size, stat.st_mtime)

        thumb = tmp_path / "thumb.jpg"
        medium = tmp_path / "medium.jpg"
        large = tmp_path / "large.jpg"
        make_image(thumb)
        make_image(medium)
        make_image(large)

        db.mark_processed(fp, {
            'thumbnail': str(thumb),
            'medium': str(medium),
            'large': str(large)
        })

        assert db.is_up_to_date(fp, "abc123", stat.st_size, stat.st_mtime) is True

        os.remove(str(medium))

        assert db.is_up_to_date(fp, "abc123", stat.st_size, stat.st_mtime) is False

    def test_is_up_to_date_hash_mismatch_returns_false(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp = str(tmp_path / "test.jpg")
        make_image(fp)
        stat = os.stat(fp)

        db.upsert_asset(fp, "hash_old", stat.st_size, stat.st_mtime)

        assert db.is_up_to_date(fp, "hash_new", stat.st_size, stat.st_mtime) is False

    def test_is_up_to_date_status_not_processed_returns_false(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp = str(tmp_path / "test.jpg")
        make_image(fp)
        stat = os.stat(fp)

        db.upsert_asset(fp, "abc123", stat.st_size, stat.st_mtime)

        assert db.is_up_to_date(fp, "abc123", stat.st_size, stat.st_mtime) is False

    def test_is_up_to_date_no_record_returns_false(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        assert db.is_up_to_date("/no/such/file.jpg", "abc", 100, 123.0) is False

    def test_purge_missing_assets(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp1 = str(tmp_path / "a.jpg")
        fp2 = str(tmp_path / "b.jpg")
        fp3 = str(tmp_path / "c.jpg")

        db.upsert_asset(fp1, "h1", 100, 123.0)
        db.upsert_asset(fp2, "h2", 200, 456.0)
        db.upsert_asset(fp3, "h3", 300, 789.0)

        removed = db.purge_missing_assets([fp1, fp3])
        assert removed == 1
        assert db.get_record_by_path(fp1) is not None
        assert db.get_record_by_path(fp2) is None
        assert db.get_record_by_path(fp3) is not None

    def test_mark_failed(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        fp = str(tmp_path / "test.jpg")
        db.upsert_asset(fp, "h1", 100, 123.0)
        db.mark_failed(fp, "test error")
        rec = db.get_record_by_path(fp)
        assert rec['status'] == 'failed'
        assert rec['error_message'] == 'test error'
        assert rec['processed_at'] is not None

    def test_get_stats(self, tmp_path):
        db = Database(str(tmp_path / "test.db"))
        for i in range(3):
            db.upsert_asset(f"/tmp/{i}.jpg", f"h{i}", 100, 123.0)
        db.mark_processed("/tmp/0.jpg", {})
        db.mark_failed("/tmp/1.jpg", "error")

        stats = db.get_stats()
        assert stats.get('processed') == 1
        assert stats.get('pending') == 1
        assert stats.get('failed') == 1
