"""验证 validator bug 2 修复: 故意清空目标 department 表, 校验应抓到。"""
import sqlite3
from config import load_rules
from scanner import Scanner
from validator import Validator

# 1. 清空目标 department
tgt = sqlite3.connect("masked.db")
tgt.execute("DELETE FROM department")
tgt.commit()
tgt.close()
print("已清空目标 department 表 (模拟 bug 复现)")

# 2. 跑校验
rules = load_rules("rules.yaml")
scan = Scanner("raw.db", rules).scan()
v = Validator("raw.db", "masked.db", rules)
r = v.validate(scan)

for tv in r.tables:
    if tv.table == "department":
        print("\ndepartment 校验结果:")
        print(f"  行数一致    : {tv.row_count_match}")
        print(f"  行数 源/目标: {tv.source_rows} / {tv.target_rows}")
        print(f"  非敏感不一致: {tv.non_sensitive_mismatches}")
        print(f"  疑似漏脱    : {tv.sensitive_leaks}")
        print(f"  passed      : {tv.passed}")
        for note in tv.notes:
            print(f"  notes       : {note}")

print(f"\n整体 passed : {r.passed}")
print(f"total_mismatches: {r.total_mismatches}")
assert not tv.row_count_match, "行数一致应为 False"
assert tv.non_sensitive_mismatches == tv.source_rows, \
    f"非敏感不一致行数应等于源行数 {tv.source_rows}, 实际 {tv.non_sensitive_mismatches}"
assert not tv.passed, "passed 应为 False"
print("\n✓ validator bug 2 已修复: 目标 0 行时能正确报告行数不一致和非敏感不一致")

# 3. 恢复: 重跑管道
import os
os.remove("consistency_map.db")
os.remove("masked.db")
import subprocess
subprocess.run(
    [".venv/bin/python", "mask.py", "run", "--source", "raw.db",
     "--target", "masked.db", "--rules", "rules.yaml"],
    check=True, capture_output=True,
)
print("\n已重跑管道恢复数据")
t = sqlite3.connect("masked.db").execute(
    "SELECT COUNT(*) FROM department"
).fetchone()[0]
print(f"department 行数: {t}")
assert t == 5, f"应为 5, 实际 {t}"
print("✓ 数据恢复成功")
