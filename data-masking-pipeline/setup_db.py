"""生成示例源数据库 raw.db, 用于演示脱敏管道。

包含 3 张表, 覆盖两种识别路径:
  users   : 列名语义命中 (phone/idcard/email/bankcard)
  orders  : 列名语义命中 (bankcard) + 非敏感业务字段
  profile : 列名无语义信息, 仅靠正则匹配值识别 (contact / cert / mail)
"""
from __future__ import annotations

import os
import random
import sqlite3

random.seed(20260621)

NAMES = [
    "张伟", "王芳", "李娜", "刘洋", "陈静", "杨帆", "赵磊", "黄敏",
    "周杰", "吴婷", "徐强", "孙丽", "马超", "朱琳", "胡军", "郭萍",
]


def gen_phone() -> str:
    prefixes = ["138", "139", "150", "151", "176", "186", "188", "199"]
    return random.choice(prefixes) + "".join(str(random.randint(0, 9)) for _ in range(8))


def gen_idcard() -> str:
    region = random.choice(["110101", "310104", "440106", "510107", "330106"])
    year = random.randint(1960, 2005)
    month = f"{random.randint(1, 12):02d}"
    day = f"{random.randint(1, 28):02d}"
    seq = f"{random.randint(0, 999):03d}"
    body = f"{region}{year}{month}{day}{seq}"
    check = "X" if random.random() < 0.1 else str(random.randint(0, 9))
    return body + check


def gen_bankcard() -> str:
    return "6222" + "".join(str(random.randint(0, 9)) for _ in range(12))


def gen_email(idx: int) -> str:
    domains = ["gmail.com", "163.com", "qq.com", "outlook.com", "126.com"]
    return f"user{idx}@{random.choice(domains)}"


def build_sample_db(path: str = "raw.db", n_users: int = 200, n_orders: int = 400) -> None:
    if os.path.exists(path):
        os.remove(path)
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE users (
                id        INTEGER PRIMARY KEY,
                name      TEXT,
                phone     TEXT,
                idcard    TEXT,
                email     TEXT,
                created_at TEXT
            );
            CREATE TABLE orders (
                id        INTEGER PRIMARY KEY,
                user_id   INTEGER,
                amount    REAL,
                bankcard  TEXT,
                remark    TEXT,
                created_at TEXT
            );
            CREATE TABLE profile (
                id      INTEGER PRIMARY KEY,
                contact TEXT,
                cert    TEXT,
                mail    TEXT,
                bio     TEXT
            );
            """
        )

        users = []
        for i in range(1, n_users + 1):
            users.append((
                i,
                random.choice(NAMES),
                gen_phone(),
                gen_idcard(),
                gen_email(i),
                f"2026-0{random.randint(1, 6)}-{random.randint(1, 28):02d}",
            ))
        conn.executemany(
            "INSERT INTO users (id,name,phone,idcard,email,created_at) "
            "VALUES (?,?,?,?,?,?)",
            users,
        )

        orders = []
        for i in range(1, n_orders + 1):
            orders.append((
                i,
                random.randint(1, n_users),
                round(random.uniform(10, 9999), 2),
                gen_bankcard(),
                random.choice(["正常", "加急", "退款", "已完成"]),
                f"2026-0{random.randint(1, 6)}-{random.randint(1, 28):02d}",
            ))
        conn.executemany(
            "INSERT INTO orders (id,user_id,amount,bankcard,remark,created_at) "
            "VALUES (?,?,?,?,?,?)",
            orders,
        )

        profiles = []
        for i in range(1, n_users + 1):
            profiles.append((
                i,
                gen_phone(),
                gen_idcard(),
                gen_email(i),
                "普通用户",
            ))
        conn.executemany(
            "INSERT INTO profile (id,contact,cert,mail,bio) VALUES (?,?,?,?,?)",
            profiles,
        )

        conn.commit()
        print(
            f"已生成示例库: {os.path.abspath(path)}\n"
            f"  users  : {n_users} 行\n"
            f"  orders : {n_orders} 行\n"
            f"  profile: {n_users} 行"
        )
    finally:
        conn.close()


if __name__ == "__main__":
    build_sample_db("raw.db")
