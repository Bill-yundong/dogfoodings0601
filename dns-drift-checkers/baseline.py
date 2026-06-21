"""Baseline declaration loader — reads expected DNS records from a YAML file."""

import os

import yaml

SUPPORTED_TYPES = ("A", "CNAME", "MX")


class Baseline:
    def __init__(self, nameserver, timeout, zones):
        self.nameserver = nameserver
        self.timeout = timeout
        self.zones = zones

    def domains(self):
        return list(self.zones.keys())


def _normalize(value, record_type):
    text = str(value).strip().lower()
    if record_type in ("CNAME", "MX"):
        text = text.rstrip(".").strip()
    if record_type == "MX":
        parts = text.split()
        if len(parts) >= 2:
            text = " ".join([parts[0]] + parts[1:])
        text = " ".join(text.split())
    return text


class BaselineLoader:
    def __init__(self, path):
        self.path = path

    def load(self):
        if not os.path.isfile(self.path):
            raise FileNotFoundError(f"Baseline file not found: {self.path}")

        with open(self.path, "r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh)

        if not isinstance(raw, dict):
            raise ValueError("Baseline YAML must be a mapping at top level")

        nameserver = str(raw.get("nameserver", "8.8.8.8")).strip()
        timeout = int(raw.get("timeout", 5))

        raw_zones = raw.get("zones")
        if not isinstance(raw_zones, dict):
            raise ValueError("Baseline must contain a 'zones' mapping")

        zones = {}
        for domain, records in raw_zones.items():
            domain = domain.rstrip(".").lower()
            zone_records = {}
            if records is None:
                zones[domain] = zone_records
                continue
            if not isinstance(records, dict):
                raise ValueError(
                    f"Zone '{domain}' must be a mapping of record types"
                )
            for rtype in SUPPORTED_TYPES:
                values = records.get(rtype)
                if values is None:
                    continue
                if not isinstance(values, list):
                    raise ValueError(
                        f"Zone '{domain}' record type '{rtype}' must be a list"
                    )
                normalized = []
                for v in values:
                    norm = _normalize(v, rtype)
                    if norm:
                        normalized.append(norm)
                zone_records[rtype] = normalized
            zones[domain] = zone_records

        return Baseline(nameserver=nameserver, timeout=timeout, zones=zones)
