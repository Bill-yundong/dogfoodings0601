import sqlite3

conn = sqlite3.connect("data.db")
conn.row_factory = sqlite3.Row

print("=" * 80)
print("TARGET TABLE: customers")
print("=" * 80)
cur = conn.execute("SELECT * FROM customers ORDER BY customer_id")
cols = [d[0] for d in cur.description]
print(" | ".join(f"{c:<18}" for c in cols))
print("-" * 80)
for row in cur:
    def fmt(v):
        if v is None:
            return "NULL"
        s = str(v)
        return s[:30].replace("\n", "\\n").replace("\r", "")
    print(" | ".join(f"{fmt(row[c]):<18}" for c in cols))

print()
print("=" * 80)
print("QUARANTINE TABLE: _quarantine_rows")
print("=" * 80)
cur = conn.execute(
    "SELECT id, source_file, source_line, stage, reason, "
    "substr(raw_content,1,80) AS raw, encoding "
    "FROM _quarantine_rows ORDER BY id"
)
cols = [d[0] for d in cur.description]
print(" | ".join(f"{c:<20}" for c in cols))
print("-" * 80)
for row in cur:
    def fmt(v):
        if v is None:
            return "NULL"
        s = str(v)
        return s[:45].replace("\n", "\\n").replace("\r", "")
    print(" | ".join(f"{fmt(row[c]):<20}" for c in cols))

print()
print("=" * 80)
print("ASSERTION CHECKS")
print("=" * 80)

# C002 should have amount summed (50.00 + 75.50 = 125.50)
cur = conn.execute("SELECT amount, name FROM customers WHERE customer_id='C002'")
row = cur.fetchone()
print(f"C002 amount={row['amount']} (expected 125.5), name={row['name']!r}")
assert abs(float(row['amount']) - 125.5) < 0.001, "C002 amount sum mismatch!"

# C007 should have amount summed (120.00 + 55.50 = 175.50) and age=35
cur = conn.execute("SELECT amount, age, name FROM customers WHERE customer_id='C007'")
row = cur.fetchone()
print(f"C007 amount={row['amount']} (expected 175.5), age={row['age']} (expected 35)")
assert abs(float(row['amount']) - 175.5) < 0.001, "C007 amount sum mismatch!"
assert row['age'] == 35, f"C007 age mismatch, got {row['age']}"

# C003: null tokens
cur = conn.execute("SELECT * FROM customers WHERE customer_id='C003'")
row = cur.fetchone()
print(f"C003 null-token fields: name={row['name']!r} email={row['email']!r} city={row['city']!r} age={row['age']!r} amount={row['amount']!r}")
assert row['name'] is None
assert row['email'] is None
assert row['city'] is None
assert row['age'] is None
assert row['amount'] is None

# C001 merged from UTF8 + GBK, amount sum: 100.5 + 88.88 = 189.38
cur = conn.execute("SELECT name, email, amount FROM customers WHERE customer_id='C001'")
row = cur.fetchone()
print(f"C001 merged: name={row['name']!r}, email={row['email']!r}, amount={row['amount']!r}")
assert abs(float(row['amount']) - 189.38) < 0.001, f"C001 amount={row['amount']}, expected 189.38"

# Latin1 customers C009-C012 should be there
cur = conn.execute(
    "SELECT COUNT(*) as cnt FROM customers WHERE customer_id IN "
    "('C009','C010','C011','C012')"
)
cnt = cur.fetchone()['cnt']
print(f"Latin1 customers (C009-C012) present: {cnt}/4")
assert cnt == 4

# C012 (Latin1 Søren) - check remark is NULL because it was the token "null"
cur = conn.execute("SELECT remark, name FROM customers WHERE customer_id='C012'")
row = cur.fetchone()
print(f"C012 name={row['name']!r}, remark={row['remark']!r} (expected NULL)")
assert row['remark'] is None

# Quarantine count
cur = conn.execute("SELECT COUNT(*) as cnt FROM _quarantine_rows")
qcount = cur.fetchone()['cnt']
print(f"Quarantine rows: {qcount} (expected 3)")
assert qcount == 3

# Check quarantine details
cur = conn.execute(
    "SELECT source_line, reason FROM _quarantine_rows ORDER BY source_file, source_line"
)
for r in cur:
    print(f"  Q: line={r['source_line']} reason={r['reason']}")

print()
print("All assertion checks passed!")
conn.close()
