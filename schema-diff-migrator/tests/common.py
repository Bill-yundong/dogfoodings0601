import sqlite3


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
