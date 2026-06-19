import os
import tempfile
import unittest

from schema_diff import Snapshot

from tests.common import create_v1_db


class TestSnapshot(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.tmpdir, "test.db")
        create_v1_db(self.db_path)

    def test_snapshot_basic(self):
        snap = Snapshot(self.db_path).take()
        self.assertIn("version", snap)
        self.assertIn("tables", snap)
        self.assertIn("indices", snap)
        self.assertIn("users", snap["tables"])
        self.assertIn("posts", snap["tables"])

    def test_snapshot_columns(self):
        snap = Snapshot(self.db_path).take()
        users = snap["tables"]["users"]
        self.assertIn("username", users["columns"])
        self.assertIn("email", users["columns"])
        self.assertEqual(users["columns"]["id"]["pk"], True)
        self.assertEqual(users["columns"]["username"]["notnull"], True)

    def test_snapshot_foreign_keys(self):
        snap = Snapshot(self.db_path).take()
        posts = snap["tables"]["posts"]
        self.assertTrue(len(posts["foreign_keys"]) > 0)
        fk = posts["foreign_keys"][0]
        self.assertEqual(fk["table"], "users")
        self.assertEqual(fk["from"], "user_id")
        self.assertEqual(fk["to"], "id")

    def test_snapshot_indices(self):
        snap = Snapshot(self.db_path).take()
        self.assertIn("idx_posts_user", snap["indices"])
        idx = snap["indices"]["idx_posts_user"]
        self.assertEqual(idx["table"], "posts")
        self.assertEqual(idx["columns"], ["user_id"])
        self.assertEqual(idx["unique"], False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
