from src.importer import _parse_tags, _detect_provider


class TestParseTags:
    def test_parse_tags_json_object(self):
        raw = '{"CostCenter": "team-order", "Env": "prod"}'
        result = _parse_tags(raw)
        assert result["CostCenter"] == "team-order"
        assert result["Env"] == "prod"

    def test_parse_tags_json_array(self):
        raw = '[{"Key": "CostCenter", "Value": "team-order"}, {"Key": "Team", "Value": "team-payment"}]'
        result = _parse_tags(raw)
        assert result["CostCenter"] == "team-order"
        assert result["Team"] == "team-payment"

    def test_parse_tags_key_value_separator(self):
        raw = "CostCenter=team-order;Team:team-user,Name=myapp"
        result = _parse_tags(raw)
        assert result["CostCenter"] == "team-order"
        assert result["Team"] == "team-user"
        assert result["Name"] == "myapp"

    def test_parse_tags_empty(self):
        assert _parse_tags(None) == {}
        assert _parse_tags("") == {}
        assert _parse_tags("{}") == {}

    def test_parse_tags_garbage_returns_empty(self):
        result = _parse_tags("not-json-at-all")
        assert result == {}


class TestDetectProvider:
    def test_detect_aliyun(self):
        headers = ["BillingCycle", "ProductCode", "PretaxGrossAmount", "InstanceId"]
        assert _detect_provider(headers) == "aliyun"

    def test_detect_aliyun_chinese_headers(self):
        headers = ["账单周期", "产品名称", "原价", "资源ID"]
        assert _detect_provider(headers) == "aliyun"

    def test_detect_aws(self):
        headers = ["lineItem/ProductCode", "lineItem/UnblendedCost", "bill/BillingPeriodStartDate"]
        assert _detect_provider(headers) == "aws"

    def test_detect_tencent(self):
        headers = ["BillingMonth", "RealTotalCost", "ProductName"]
        assert _detect_provider(headers) == "tencent"

    def test_detect_generic(self):
        headers = ["service", "cost", "month", "resource_id"]
        assert _detect_provider(headers) == "generic"
