import json
import os
import tempfile
import unittest

from schema_diff import main

from tests.common import create_v1_db, create_v2_db


class TestCLI(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.v1_path = os.path.join(self.tmpdir, "v1.db")
        self.v2_path = os.path.join(self.tmpdir, "v2.db")
        self.v1_json = os.path.join(self.tmpdir, "v1.json")
        self.v2_json = os.path.join(self.tmpdir, "v2.json")
        create_v1_db(self.v1_path)
        create_v2_db(self.v2_path)

    def test_snapshot_cli(self):
        rc = main(["snapshot", self.v1_path, "-o", self.v1_json])
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.isfile(self.v1_json))
        with open(self.v1_json) as f:
            data = json.load(f)
        self.assertIn("tables", data)

    def test_migrate_cli(self):
        main(["snapshot", self.v1_path, "-o", self.v1_json])
        main(["snapshot", self.v2_path, "-o", self.v2_json])
        out_sql = os.path.join(self.tmpdir, "migrate.sql")
        rc = main(["migrate", self.v1_json, self.v2_json, "-o", out_sql])
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.isfile(out_sql))
        with open(out_sql) as f:
            content = f.read()
        self.assertIn("-- Schema Diff Migration", content)

    def test_diff_cli(self):
        main(["snapshot", self.v1_path, "-o", self.v1_json])
        main(["snapshot", self.v2_path, "-o", self.v2_json])
        rc = main(["diff", self.v1_json, self.v2_json])
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
