import yaml
import os
from typing import Dict, List, Any


class BaselineLoader:
    VALID_TYPES = {"A", "CNAME", "MX"}

    def __init__(self, yaml_path: str):
        self.yaml_path = yaml_path
        self.zones: Dict[str, Dict[str, List[str]]] = {}
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.yaml_path):
            raise FileNotFoundError(f"Baseline file not found: {self.yaml_path}")

        with open(self.yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        if not isinstance(data, dict):
            raise ValueError("Baseline YAML must be a mapping (dictionary)")

        if "zones" not in data:
            raise ValueError("Missing 'zones' key in baseline YAML")

        for zone_name, records in data["zones"].items():
            self._validate_zone(zone_name, records)
            self.zones[zone_name] = records

    def _validate_zone(self, zone_name: str, records: Dict[str, Any]) -> None:
        if not isinstance(records, dict):
            raise ValueError(f"Zone '{zone_name}' must contain a mapping of record types to values")

        for rtype, values in records.items():
            if rtype not in self.VALID_TYPES:
                raise ValueError(
                    f"Unsupported record type '{rtype}' in zone '{zone_name}'. "
                    f"Supported types: {', '.join(sorted(self.VALID_TYPES))}"
                )
            if not isinstance(values, list):
                raise ValueError(f"Record type '{rtype}' in zone '{zone_name}' must be a list")
            for v in values:
                if not isinstance(v, str):
                    raise ValueError(
                        f"All values for '{rtype}' in zone '{zone_name}' must be strings"
                    )

    def get_zone(self, zone_name: str) -> Dict[str, List[str]]:
        return self.zones.get(zone_name, {})

    def all_zones(self) -> Dict[str, Dict[str, List[str]]]:
        return dict(self.zones)

    def list_zones(self) -> List[str]:
        return list(self.zones.keys())
