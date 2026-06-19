import os
import tempfile
import unittest

from schema_diff import Differ, MigrationGenerator, Snapshot

from tests.common import create_v1_db, create_v2_db


class TestMigrationGenerator(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.v1_path = os.path.join(self.tmpdir, "v1.db")
        self.v2_path = os.path.join(self.tmpdir, "v2.db")
        create_v1_db(self.v1_path)
        create_v2_db(self.v2_path)
        self.v1 = Snapshot(self.v1_path).take()
        self.v2 = Snapshot(self.v2_path).take()
        self.diff = Differ(self.v1, self.v2).diff()
        self.migrations = MigrationGenerator(self.diff).generate()

    def test_migrations_not_empty(self):
        self.assertTrue(len(self.migrations) > 0)

    def test_create_table_generated(self):
        create_tags = any("CREATE TABLE" in s and "tags" in s for s in self.migrations)
        self.assertTrue(create_tags)

    def test_add_column_generated(self):
        add_updated = any("ADD COLUMN" in s and "updated_at" in s for s in self.migrations)
        self.assertTrue(add_updated)

    def test_valid_sql(self):
        for stmt in self.migrations:
            self.assertTrue(stmt.endswith(";") or stmt.startswith("--"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
