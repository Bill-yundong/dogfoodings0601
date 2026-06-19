"""One-shot generator for sample raw CSV files under ./raw/.

Produces three files with a variety of dirty-data scenarios:

* ``raw/customers_utf8.csv``  - UTF-8 with:
      - embedded commas inside quoted fields
      - embedded newlines inside quoted fields
      - NULL / NULL-ish tokens ("null", "N/A", empty)
      - a deliberate half-quote that should be quarantined
      - a duplicate primary key (C002) whose `amount` should be summed
* ``raw/customers_gbk.csv``   - GBK-encoded, CJK headers, duplicate of C001
* ``raw/customers_latin1.csv``- Latin-1 encoded, European names with accents
                                 and a stray extra comma that should go to
                                 quarantine.

Run this script once with ``python3 _make_samples.py`` before running the
pipeline for the first time.
"""

from __future__ import annotations

import os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
os.makedirs(RAW, exist_ok=True)

# ---------------------------------------------------------------- UTF-8 file
utf8_text = """id,name,email,city,age,amount,remark
C001,"Alice, M.","alice@example.com",New York,32,100.5,"VIP client"
C002,"Bob
Junior",bob@example.com,Los Angeles,28,50.0,"Has multi-line
address field"
C002,"Robert Jr.",bob+dupe@example.com,LA,28,75.50,"duplicate of C002 - amount should sum"
C003,null,null,N/A,NULL,-,
C004,"Carol","carol@example.com",Chicago,,200.0,
C005,"broken "quote" here",bad@example.com,Boston,40,10.0,"half quote inside unquoted-ish field"
C006,"Dave","dave@example.com",Seattle,45,300.0,"clean row for reference"
"""

utf8_path = os.path.join(RAW, "customers_utf8.csv")
with open(utf8_path, "wb") as fh:
    fh.write(utf8_text.encode("utf-8"))
print(f"wrote {utf8_path}")

# ------------------------------------------------------------------ GBK file
gbk_text = (
    "客户编号,姓名,邮箱,城市,年龄,金额,备注\r\n"
    'C001,"李晓红","lixiaohong@example.cn","北京",30,88.88,"VIP 客户,来自GBK文件"\r\n'
    'C007,"王大明","wangdaming@example.cn","上海",NULL,120.00,"金额字段需要求和"\r\n'
    'C007,"王大明(别名)","wangdaming2@example.cn","上海",35,55.50,"重复主键 C007"\r\n'
    'C008,"赵丽","",,,"缺少多个字段"\r\n'
)
gbk_path = os.path.join(RAW, "customers_gbk.csv")
with open(gbk_path, "wb") as fh:
    fh.write(gbk_text.encode("gbk"))
print(f"wrote {gbk_path}")

# ---------------------------------------------------------------- Latin1 file
latin1_text = (
    "id,name,email,city,age,amount,remark\n"
    "C009,José García,jose@example.es,Madrid,38,210.75,cliente latino\n"
    "C010,François Dupont,francois@example.fr,Paris,42,150.00,très bon client\n"
    "C011,Müller GmbH,muller@example.de,Berlin,29,99.99,geschäftskunde\n"
    "C012,Søren Jensen,soren@example.dk,Copenhagen,25,40.00,null\n"
    "C013,stray,comma,row,has,extra,commas,here,oops\n"
)
latin1_path = os.path.join(RAW, "customers_latin1.csv")
with open(latin1_path, "wb") as fh:
    fh.write(latin1_text.encode("latin-1"))
print(f"wrote {latin1_path}")

# Also drop an empty file so the "skipped" counter has something to show.
empty_path = os.path.join(RAW, "empty.csv")
with open(empty_path, "wb") as fh:
    fh.write(b"")
print(f"wrote {empty_path}")

print("\nAll sample files generated.")
