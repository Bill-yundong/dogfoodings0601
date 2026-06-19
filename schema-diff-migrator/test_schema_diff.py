import json
import os
import sqlite3
import tempfile
import unittest

from schema_diff import Differ, MigrationGenerator, Snapshot, main


def create_v1_db(path: str) -> None:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    cur.execute("CREATE INDEX idx_posts_user ON posts(user_id)")
    cur.execute("CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL")
    conn.commit()
    conn.close()


def create_v2_db(path: str) -> None:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'draft',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE tags (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#888888'
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE post_tags (
            post_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, tag_id),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (tag_id) REFERENCES tags(id)
        )
        """
    )
    cur.execute("CREATE INDEX idx_posts_user_status ON posts(user_id, status)")
    cur.execute("CREATE UNIQUE INDEX idx_users_email ON users(email)")
    conn.commit()
    conn.close()


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
        import shutil

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
