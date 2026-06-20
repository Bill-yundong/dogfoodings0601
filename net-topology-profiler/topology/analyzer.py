import math
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
import json


@dataclass
class LinkQualityMetrics:
    link_id: str
    source: str
    target: str
    packet_loss_rate: float = 0.0
    jitter_ms: float = 0.0
    avg_latency_ms: float = 0.0
    min_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    latency_stddev_ms: float = 0.0
    latency_percentiles: Dict[str, float] = field(default_factory=dict)
    quality_score: float = 0.0
    quality_grade: str = "unknown"
    sample_count: int = 0
    latency_samples: List[float] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "link_id": self.link_id,
            "source": self.source,
            "target": self.target,
            "packet_loss_rate": round(self.packet_loss_rate, 3),
            "jitter_ms": round(self.jitter_ms, 3),
            "avg_latency_ms": round(self.avg_latency_ms, 3),
            "min_latency_ms": round(self.min_latency_ms, 3),
            "max_latency_ms": round(self.max_latency_ms, 3),
            "latency_stddev_ms": round(self.latency_stddev_ms, 3),
            "latency_percentiles": {k: round(v, 3) for k, v in self.latency_percentiles.items()},
            "quality_score": round(self.quality_score, 2),
            "quality_grade": self.quality_grade,
            "sample_count": self.sample_count,
        }


class LinkQualityAnalyzer:
    def __init__(self):
        self.link_metrics: Dict[str, LinkQualityMetrics] = {}
        self._node_rtt_samples: Dict[str, List[float]] = defaultdict(list)
        self._node_loss_samples: Dict[str, List[float]] = defaultdict(list)

    def add_traceroute_result(self, target: str, trace_result):
        prev_hop_ip = None

        for hop in trace_result.hops:
            if hop.ip == "*" or not hop.ip:
                continue

            node_key = hop.ip
            if hop.avg_rtt_ms > 0:
                self._node_rtt_samples[node_key].append(hop.avg_rtt_ms)
            self._node_loss_samples[node_key].append(hop.packet_loss)

            if prev_hop_ip is not None:
                link_id = f"{prev_hop_ip}->{hop.ip}"
                if link_id not in self.link_metrics:
                    self.link_metrics[link_id] = LinkQualityMetrics(
                        link_id=link_id,
                        source=prev_hop_ip,
                        target=hop.ip,
                    )

                metrics = self.link_metrics[link_id]
                if hop.avg_rtt_ms > 0:
                    metrics.latency_samples.append(hop.avg_rtt_ms)
                    metrics.sample_count += 1

                metrics.packet_loss_rate = (
                    metrics.packet_loss_rate * (metrics.sample_count - 1) + hop.packet_loss
                ) / max(metrics.sample_count, 1)

            prev_hop_ip = hop.ip

    def analyze_all(self):
        for link_id, metrics in self.link_metrics.items():
            self._compute_link_statistics(metrics)
            self._compute_quality_score(metrics)

    def _compute_link_statistics(self, metrics: LinkQualityMetrics):
        samples = metrics.latency_samples
        if not samples:
            return

        metrics.min_latency_ms = min(samples)
        metrics.max_latency_ms = max(samples)
        metrics.avg_latency_ms = sum(samples) / len(samples)

        if len(samples) >= 2:
            mean = metrics.avg_latency_ms
            variance = sum((x - mean) ** 2 for x in samples) / len(samples)
            metrics.latency_stddev_ms = math.sqrt(variance)
            metrics.jitter_ms = metrics.max_latency_ms - metrics.min_latency_ms
        else:
            metrics.latency_stddev_ms = 0.0
            metrics.jitter_ms = 0.0

        sorted_samples = sorted(samples)
        n = len(sorted_samples)
        percentiles = [50, 75, 90, 95, 99]
        for p in percentiles:
            idx = int(p / 100 * n) - 1
            idx = max(0, min(idx, n - 1))
            metrics.latency_percentiles[f"p{p}"] = sorted_samples[idx]

    def _compute_quality_score(self, metrics: LinkQualityMetrics):
        latency_score = self._score_latency(metrics.avg_latency_ms)
        loss_score = self._score_packet_loss(metrics.packet_loss_rate)
        jitter_score = self._score_jitter(metrics.jitter_ms)

        metrics.quality_score = (
            latency_score * 0.4 + loss_score * 0.4 + jitter_score * 0.2
        )

        if metrics.quality_score >= 90:
            metrics.quality_grade = "excellent"
        elif metrics.quality_score >= 75:
            metrics.quality_grade = "good"
        elif metrics.quality_score >= 60:
            metrics.quality_grade = "fair"
        elif metrics.quality_score >= 40:
            metrics.quality_grade = "poor"
        else:
            metrics.quality_grade = "critical"

    def _score_latency(self, latency_ms: float) -> float:
        if latency_ms <= 1:
            return 100
        elif latency_ms <= 10:
            return 100 - (latency_ms - 1) * 2
        elif latency_ms <= 50:
            return 82 - (latency_ms - 10) * 0.8
        elif latency_ms <= 100:
            return 50 - (latency_ms - 50) * 0.5
        elif latency_ms <= 200:
            return 25 - (latency_ms - 100) * 0.2
        else:
            return max(0, 5 - (latency_ms - 200) * 0.05)

    def _score_packet_loss(self, loss_rate: float) -> float:
        if loss_rate <= 0.1:
            return 100
        elif loss_rate <= 1:
            return 100 - (loss_rate - 0.1) * 20
        elif loss_rate <= 5:
            return 82 - (loss_rate - 1) * 8
        elif loss_rate <= 10:
            return 50 - (loss_rate - 5) * 6
        elif loss_rate <= 20:
            return 20 - (loss_rate - 10) * 2
        else:
            return max(0, 5 - (loss_rate - 20) * 0.5)

    def _score_jitter(self, jitter_ms: float) -> float:
        if jitter_ms <= 1:
            return 100
        elif jitter_ms <= 5:
            return 100 - (jitter_ms - 1) * 5
        elif jitter_ms <= 20:
            return 80 - (jitter_ms - 5) * 2
        elif jitter_ms <= 50:
            return 50 - (jitter_ms - 20)
        else:
            return max(0, 20 - (jitter_ms - 50) * 0.5)

    def get_link_quality(self, source: str, target: str) -> Optional[LinkQualityMetrics]:
        link_id = f"{source}->{target}"
        return self.link_metrics.get(link_id)

    def get_links_by_quality(self, min_score: float = 0, max_score: float = 100) -> List[LinkQualityMetrics]:
        return sorted(
            [m for m in self.link_metrics.values() if min_score <= m.quality_score <= max_score],
            key=lambda m: m.quality_score,
        )

    def get_overall_summary(self) -> dict:
        if not self.link_metrics:
            return {
                "total_links": 0,
                "average_quality_score": 0.0,
                "quality_grade_distribution": {},
                "average_latency_ms": 0.0,
                "average_packet_loss": 0.0,
                "average_jitter_ms": 0.0,
            }

        scores = [m.quality_score for m in self.link_metrics.values()]
        avg_score = sum(scores) / len(scores)

        grade_counts = defaultdict(int)
        for m in self.link_metrics.values():
            grade_counts[m.quality_grade] += 1

        avg_latency = sum(m.avg_latency_ms for m in self.link_metrics.values()) / len(self.link_metrics)
        avg_loss = sum(m.packet_loss_rate for m in self.link_metrics.values()) / len(self.link_metrics)
        avg_jitter = sum(m.jitter_ms for m in self.link_metrics.values()) / len(self.link_metrics)

        return {
            "total_links": len(self.link_metrics),
            "average_quality_score": round(avg_score, 2),
            "quality_grade_distribution": dict(grade_counts),
            "average_latency_ms": round(avg_latency, 3),
            "average_packet_loss": round(avg_loss, 3),
            "average_jitter_ms": round(avg_jitter, 3),
        }

    def to_dict(self) -> dict:
        return {
            "summary": self.get_overall_summary(),
            "links": [m.to_dict() for m in self.link_metrics.values()],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
