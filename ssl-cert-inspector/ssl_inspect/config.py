"""Configuration loading and validation.

Reads a YAML config (domains.yaml) and returns a normalized
``Config`` object consumed by the rest of the toolkit.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List

import yaml


DEFAULT_THRESHOLDS = {"expired": 0, "critical": 7, "warning": 30}
DEFAULT_INSPECTION = {
    "timeout": 10,
    "concurrency": 8,
    "max_retries": 2,
    "retry_backoff": 1.0,
}
DEFAULT_DATABASE_PATH = "data/ssl_inspections.db"
DEFAULT_REPORT_PATH = "reports/inspection_report.json"
DEFAULT_ALERT_EMAIL_PATH = "reports/alert_email.eml"


@dataclass
class Thresholds:
    expired: int = 0
    critical: int = 7
    warning: int = 30


@dataclass
class InspectionOptions:
    timeout: int = 10
    concurrency: int = 8
    max_retries: int = 2
    retry_backoff: float = 1.0


@dataclass
class SmtpConfig:
    enabled: bool = False
    host: str = "smtp.example.com"
    port: int = 587
    use_tls: bool = True
    username: str = ""
    password: str = ""
    from_addr: str = "ssl-alerts@example.com"
    to: List[str] = field(default_factory=list)


@dataclass
class AlertConfig:
    email_path: str = DEFAULT_ALERT_EMAIL_PATH
    smtp: SmtpConfig = field(default_factory=SmtpConfig)


@dataclass
class Config:
    domains: List[Dict[str, Any]] = field(default_factory=list)
    thresholds: Thresholds = field(default_factory=Thresholds)
    inspection: InspectionOptions = field(default_factory=InspectionOptions)
    database_path: str = DEFAULT_DATABASE_PATH
    report_path: str = DEFAULT_REPORT_PATH
    alert: AlertConfig = field(default_factory=AlertConfig)
    raw: Dict[str, Any] = field(default_factory=dict)


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def load_config(path: str) -> Config:
    """Load and validate a YAML config file into a :class:`Config`."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path, "r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}

    if not isinstance(raw, dict):
        raise ValueError("Config root must be a mapping")

    domains = raw.get("domains") or []
    if not isinstance(domains, list):
        raise ValueError("'domains' must be a list")
    normalized_domains: List[Dict[str, Any]] = []
    for entry in domains:
        if isinstance(entry, str):
            normalized_domains.append({"name": entry, "port": 443})
        elif isinstance(entry, dict) and entry.get("name"):
            normalized_domains.append(
                {"name": entry["name"], "port": int(entry.get("port", 443))}
            )
        else:
            raise ValueError(f"Invalid domain entry: {entry!r}")

    th_raw = {**DEFAULT_THRESHOLDS, **(raw.get("thresholds") or {})}
    thresholds = Thresholds(
        expired=int(th_raw["expired"]),
        critical=int(th_raw["critical"]),
        warning=int(th_raw["warning"]),
    )

    ins_raw = {**DEFAULT_INSPECTION, **(raw.get("inspection") or {})}
    inspection = InspectionOptions(
        timeout=int(ins_raw["timeout"]),
        concurrency=max(1, int(ins_raw["concurrency"])),
        max_retries=max(0, int(ins_raw["max_retries"])),
        retry_backoff=max(0.0, float(ins_raw["retry_backoff"])),
    )

    db_cfg = raw.get("database") or {}
    database_path = db_cfg.get("path", DEFAULT_DATABASE_PATH)

    report_cfg = raw.get("report") or {}
    report_path = report_cfg.get("path", DEFAULT_REPORT_PATH)

    alert_cfg = raw.get("alert") or {}
    smtp_raw = alert_cfg.get("smtp") or {}
    smtp = SmtpConfig(
        enabled=bool(smtp_raw.get("enabled", False)),
        host=smtp_raw.get("host", "smtp.example.com"),
        port=int(smtp_raw.get("port", 587)),
        use_tls=bool(smtp_raw.get("use_tls", True)),
        username=smtp_raw.get("username", ""),
        password=smtp_raw.get("password", ""),
        from_addr=smtp_raw.get("from", "ssl-alerts@example.com"),
        to=list(smtp_raw.get("to") or []),
    )
    alert = AlertConfig(
        email_path=alert_cfg.get("email_path", DEFAULT_ALERT_EMAIL_PATH),
        smtp=smtp,
    )

    return Config(
        domains=normalized_domains,
        thresholds=thresholds,
        inspection=inspection,
        database_path=database_path,
        report_path=report_path,
        alert=alert,
        raw=raw,
    )


def ensure_output_dirs(config: Config) -> None:
    """Create parent directories for the database, report and alert files."""
    _ensure_parent_dir(config.database_path)
    _ensure_parent_dir(config.report_path)
    _ensure_parent_dir(config.alert.email_path)
