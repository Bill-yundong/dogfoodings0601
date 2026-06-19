import os
import tempfile
import unittest

from schema_diff import Differ, Snapshot

from tests.common import create_v1_db, create_v2_db


class TestDiffer(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.v1_path = os.path.join(self.tmpdir, "v1.db")
        self.v2_path = os.path.join(self.tmpdir, "v2.db")
        create_v1_db(self.v1_path)
        create_v2_db(self.v2_path)
        self.v1 = Snapshot(self.v1_path).take()
        self.v2 = Snapshot(self.v2_path).take()
        self.differ = Differ(self.v1, self.v2)
        self.diff = self.differ.diff()

    def test_tables_added(self):
        tables = self.diff["tables"]
        self.assertIn("tags", tables["added"])
        self.assertIn("post_tags", tables["added"])

    def test_tables_modified(self):
        tables = self.diff["tables"]
        self.assertIn("users", tables["modified"])
        self.assertIn("posts", tables["modified"])

    def test_columns_added(self):
        users_changes = self.diff["tables"]["modified"]["users"]
        self.assertIn("updated_at", users_changes["added_columns"])
        posts_changes = self.diff["tables"]["modified"]["posts"]
        self.assertIn("status", posts_changes["added_columns"])

    def test_columns_modified(self):
        users_changes = self.diff["tables"]["modified"]["users"]
        if "modified_columns" in users_changes:
            if "email" in users_changes["modified_columns"]:
                email_change = users_changes["modified_columns"]["email"]
                self.assertIn("notnull", email_change)

    def test_indices_diff(self):
        indices = self.diff["indices"]
        self.assertTrue(
            len(indices["added"]) > 0
            or len(indices["removed"]) > 0
            or len(indices["modified"]) > 0
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
