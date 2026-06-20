"""规则配置加载器: 读取并校验 rules.yaml。"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import yaml


@dataclass
class FieldRule:
    field_type: str
    keywords: List[str] = field(default_factory=list)
    patterns: List[str] = field(default_factory=list)


@dataclass
class MaskingStrategy:
    strategy: str
    keep_prefix: int = 0
    keep_suffix: int = 0
    mask_length: int = 0
    keep_local_prefix: int = 0
    mask_char: str = "*"
    start: Optional[int] = None


@dataclass
class DetectionConfig:
    sample_size: int = 100
    match_threshold: float = 0.5


@dataclass
class Rules:
    column_rules: Dict[str, FieldRule] = field(default_factory=dict)
    masking: Dict[str, MaskingStrategy] = field(default_factory=dict)
    detection: DetectionConfig = field(default_factory=DetectionConfig)

    @property
    def field_types(self) -> List[str]:
        return list(self.column_rules.keys())


def load_rules(path: str) -> Rules:
    if not os.path.exists(path):
        raise FileNotFoundError(f"规则文件不存在: {path}")

    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    rules = Rules()

    for field_type, body in (raw.get("column_rules") or {}).items():
        rules.column_rules[field_type] = FieldRule(
            field_type=field_type,
            keywords=list(body.get("keywords", []) or []),
            patterns=list(body.get("patterns", []) or []),
        )

    for field_type, body in (raw.get("masking") or {}).items():
        rules.masking[field_type] = MaskingStrategy(
            strategy=body.get("strategy", "keep_ends"),
            keep_prefix=int(body.get("keep_prefix", 0)),
            keep_suffix=int(body.get("keep_suffix", 0)),
            mask_length=int(body.get("mask_length", 0)),
            keep_local_prefix=int(body.get("keep_local_prefix", 0)),
            mask_char=str(body.get("mask_char", "*")),
            start=int(body["start"]) if body.get("start") is not None else None,
        )

    det = raw.get("detection") or {}
    rules.detection = DetectionConfig(
        sample_size=int(det.get("sample_size", 100)),
        match_threshold=float(det.get("match_threshold", 0.5)),
    )

    _validate(rules)
    return rules


def _validate(rules: Rules) -> None:
    if not rules.column_rules:
        raise ValueError("规则文件未配置任何 column_rules")

    for field_type, rule in rules.column_rules.items():
        if not rule.keywords and not rule.patterns:
            raise ValueError(f"字段类型 {field_type} 既无 keywords 也无 patterns")

    for field_type in rules.column_rules:
        if field_type not in rules.masking:
            raise ValueError(f"字段类型 {field_type} 缺少对应的 masking 策略")

    if not (0.0 < rules.detection.match_threshold <= 1.0):
        raise ValueError("detection.match_threshold 必须在 (0, 1] 区间内")
