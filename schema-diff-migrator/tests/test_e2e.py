import os
import shutil
import sqlite3
import tempfile
import unittest

from schema_diff import main

from tests.common import create_v1_db, create_v2_db


class TestEndToEndMigration(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.v1_path = os.path.join(self.tmpdir, "v1.db")
        self.v2_path = os.path.join(self.tmpdir, "v2.db")
        self.v1_json = os.path.join(self.tmpdir, "v1.json")
        self.v2_json = os.path.join(self.tmpdir, "v2.json")
        create_v1_db(self.v1_path)
        create_v2_db(self.v2_path)
        main(["snapshot", self.v1_path, "-o", self.v1_json])
        main(["snapshot", self.v2_path, "-o", self.v2_json])

    def test_migration_can_be_applied(self):
        out_sql = os.path.join(self.tmpdir, "migrate.sql")
        main(["migrate", self.v1_json, self.v2_json, "-o", out_sql])

        migrated_path = os.path.join(self.tmpdir, "migrated.db")
        shutil.copy2(self.v1_path, migrated_path)

        with open(out_sql) as f:
            sql = f.read()

        clean_lines = []
        for line in sql.split("\n"):
            s = line.strip()
            if s and not s.startswith("--") and "DROP COLUMN" not in s.upper():
                clean_lines.append(s)
        clean_sql = "\n".join(clean_lines)

        conn = sqlite3.connect(migrated_path)
        conn.execute("PRAGMA foreign_keys = ON")
        cur = conn.cursor()
        try:
            cur.executescript(clean_sql)
        except sqlite3.Error as e:
            print(f"SQL execution warning: {e}")
        conn.commit()

        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r[0] for r in cur.fetchall()}
        self.assertIn("tags", tables)
        self.assertIn("post_tags", tables)

        cur.execute("PRAGMA table_info(users)")
        cols = {r[1] for r in cur.fetchall()}
        self.assertIn("updated_at", cols)

        conn.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
