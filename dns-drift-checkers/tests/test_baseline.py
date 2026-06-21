"""测试 baseline 模块: YAML 加载、归一化、非法输入。"""

import pytest

from baseline import BaselineLoader, _normalize, SUPPORTED_TYPES


def write_yaml(tmp_path, content, name="zones.yaml"):
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return str(p)


class TestNormalize:
    def test_a_record_ip_unchanged(self):
        assert _normalize("93.184.216.34", "A") == "93.184.216.34"

    def test_a_record_whitespace_stripped(self):
        assert _normalize("  1.2.3.4  ", "A") == "1.2.3.4"

    def test_a_record_lowercased(self):
        assert _normalize("::1", "A") == "::1"

    def test_cname_trailing_dot_stripped(self):
        assert _normalize("cdn.example.COM.", "CNAME") == "cdn.example.com"

    def test_cname_lowercased(self):
        assert _normalize("Www.Github.COM", "CNAME") == "www.github.com"

    def test_mx_null_record(self):
        assert _normalize("0 .", "MX") == "0"

    def test_mx_trailing_dot_stripped(self):
        assert _normalize("10 SMTP.gmail.COM.", "MX") == "10 smtp.gmail.com"

    def test_mx_multiple_spaces(self):
        assert _normalize("  10   mail.foo.  ", "MX") == "10 mail.foo"


class TestBaselineLoaderValid:
    def test_minimal_valid(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
nameserver: 8.8.4.4
timeout: 3
zones:
  example.com:
    A:
      - 93.184.216.34
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.nameserver == "8.8.4.4"
        assert bl.timeout == 3
        assert bl.domains() == ["example.com"]
        assert bl.zones["example.com"]["A"] == ["93.184.216.34"]

    def test_defaults_nameserver_and_timeout(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  a.com:
    A:
      - 1.1.1.1
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.nameserver == "8.8.8.8"
        assert bl.timeout == 5

    def test_domain_trailing_dot_stripped_and_lowered(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  EXAMPLE.COM.:
    A:
      - 1.2.3.4
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.domains() == ["example.com"]

    def test_mx_and_cname_normalized(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  g.com:
    MX:
      - "10 SMTP.gmail.COM."
    CNAME:
      - "Www.Google.COM."
""",
        )
        bl = BaselineLoader(path).load()
        zone = bl.zones["g.com"]
        assert zone["MX"] == ["10 smtp.gmail.com"]
        assert zone["CNAME"] == ["www.google.com"]

    def test_null_mx_record_normalized(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  ex.com:
    MX:
      - "0 ."
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.zones["ex.com"]["MX"] == ["0"]

    def test_empty_values_filtered(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  ex.com:
    A:
      - ""
      - "   "
      - 1.1.1.1
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.zones["ex.com"]["A"] == ["1.1.1.1"]

    def test_null_zone_records(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  empty.com:
  another.com:
    A:
      - 1.2.3.4
""",
        )
        bl = BaselineLoader(path).load()
        assert "empty.com" in bl.zones
        assert bl.zones["empty.com"] == {}
        assert bl.zones["another.com"]["A"] == ["1.2.3.4"]

    def test_multiple_domains_preserved_order(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  z.com:
    A: [1.1.1.1]
  a.com:
    A: [2.2.2.2]
  m.com:
    A: [3.3.3.3]
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.domains() == ["z.com", "a.com", "m.com"]

    def test_supported_types_only(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  ex.com:
    A: [1.1.1.1]
    CNAME: [c.ex.com]
    MX: [10 m.ex.com]
    TXT: [ignored]
    AAAA: [ignored]
""",
        )
        bl = BaselineLoader(path).load()
        zone = bl.zones["ex.com"]
        assert sorted(zone.keys()) == ["A", "CNAME", "MX"]


class TestBaselineLoaderErrors:
    def test_file_not_found(self, tmp_path):
        path = str(tmp_path / "nope.yaml")
        with pytest.raises(FileNotFoundError, match="Baseline file not found"):
            BaselineLoader(path).load()

    def test_top_level_not_mapping(self, tmp_path):
        path = write_yaml(tmp_path, "- just a list\n- of strings")
        with pytest.raises(ValueError, match="must be a mapping"):
            BaselineLoader(path).load()

    def test_missing_zones(self, tmp_path):
        path = write_yaml(tmp_path, "nameserver: 1.1.1.1")
        with pytest.raises(ValueError, match="must contain a 'zones' mapping"):
            BaselineLoader(path).load()

    def test_zones_not_mapping(self, tmp_path):
        path = write_yaml(tmp_path, "zones: [1, 2, 3]")
        with pytest.raises(ValueError, match="must contain a 'zones' mapping"):
            BaselineLoader(path).load()

    def test_zone_not_mapping(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  bad.com: "this is not a dict"
""",
        )
        with pytest.raises(ValueError, match="must be a mapping"):
            BaselineLoader(path).load()

    def test_record_type_not_list(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  ex.com:
    A: "not a list"
""",
        )
        with pytest.raises(ValueError, match="must be a list"):
            BaselineLoader(path).load()

    def test_cname_not_list(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  ex.com:
    CNAME: 123
""",
        )
        with pytest.raises(ValueError, match="CNAME"):
            BaselineLoader(path).load()

    def test_mx_not_list(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
zones:
  ex.com:
    MX:
      priority: 10
      exchange: foo.com
""",
        )
        with pytest.raises(ValueError, match="MX.*must be a list"):
            BaselineLoader(path).load()

    def test_timeout_cast_to_int(self, tmp_path):
        path = write_yaml(
            tmp_path,
            """
timeout: "7"
zones:
  ex.com:
    A: [1.1.1.1]
""",
        )
        bl = BaselineLoader(path).load()
        assert bl.timeout == 7
