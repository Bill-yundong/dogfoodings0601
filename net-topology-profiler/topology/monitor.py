import json
import os
import time
import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Set
from collections import defaultdict

from .scanner import NetworkScanner
from .tracer import TracerouteProbe
from .builder import TopologyBuilder
from .analyzer import LinkQualityAnalyzer


@dataclass
class NodeSnapshot:
    ip: str
    node_type: str = "router"
    is_alive: bool = True
    avg_rtt_ms: float = 0.0
    packet_loss: float = 0.0


@dataclass
class LinkSnapshot:
    link_id: str
    source_ip: str
    target_ip: str
    quality_score: float = 0.0
    avg_rtt_ms: float = 0.0
    packet_loss: float = 0.0
    jitter_ms: float = 0.0


@dataclass
class TopologyChanges:
    new_nodes: List[str] = field(default_factory=list)
    disappeared_nodes: List[str] = field(default_factory=list)
    new_links: List[str] = field(default_factory=list)
    disappeared_links: List[str] = field(default_factory=list)


@dataclass
class MonitorRound:
    round_number: int
    timestamp: str
    nodes: List[NodeSnapshot] = field(default_factory=list)
    links: List[LinkSnapshot] = field(default_factory=list)
    changes: TopologyChanges = field(default_factory=TopologyChanges)
    alive_host_count: int = 0
    duration_seconds: float = 0.0

    def to_dict(self) -> dict:
        return {
            "round": self.round_number,
            "timestamp": self.timestamp,
            "alive_host_count": self.alive_host_count,
            "duration_seconds": round(self.duration_seconds, 2),
            "nodes": [
                {
                    "ip": n.ip,
                    "node_type": n.node_type,
                    "is_alive": n.is_alive,
                    "avg_rtt_ms": round(n.avg_rtt_ms, 3),
                    "packet_loss": round(n.packet_loss, 2),
                }
                for n in self.nodes
            ],
            "links": [
                {
                    "link_id": l.link_id,
                    "source": l.source_ip,
                    "target": l.target_ip,
                    "quality_score": round(l.quality_score, 2),
                    "avg_rtt_ms": round(l.avg_rtt_ms, 3),
                    "packet_loss": round(l.packet_loss, 2),
                    "jitter_ms": round(l.jitter_ms, 3),
                }
                for l in self.links
            ],
            "changes": {
                "new_nodes": self.changes.new_nodes,
                "disappeared_nodes": self.changes.disappeared_nodes,
                "new_links": self.changes.new_links,
                "disappeared_links": self.changes.disappeared_links,
            },
        }


class TopologyMonitor:
    def __init__(
        self,
        scanner: NetworkScanner,
        tracer: TracerouteProbe,
        subnet: str,
        interval: int = 60,
        rounds: int = 5,
        history_path: str = "monitor_history.json",
    ):
        self.scanner = scanner
        self.tracer = tracer
        self.subnet = subnet
        self.interval = interval
        self.rounds = rounds
        self.history_path = history_path
        self.rounds_data: List[MonitorRound] = []
        self._prev_node_ips: Set[str] = set()
        self._prev_link_ids: Set[str] = set()

    def _run_single_round(self, round_number: int) -> MonitorRound:
        start_time = time.time()
        timestamp = datetime.now().isoformat()

        alive_hosts = self.scanner.scan_subnet(self.subnet)

        target_ips = [h.ip for h in alive_hosts]
        trace_results = {}
        if target_ips:
            trace_results = self.tracer.trace_multiple(target_ips)

        builder = TopologyBuilder()
        builder.build_from_traceroute_results(trace_results, alive_hosts)

        analyzer = LinkQualityAnalyzer()
        for target, result in trace_results.items():
            analyzer.add_traceroute_result(target, result)
        analyzer.analyze_all()

        ip_to_id = {n.ip: n.id for n in builder.nodes.values()}

        node_snapshots: List[NodeSnapshot] = []
        for node in builder.nodes.values():
            node_snapshots.append(NodeSnapshot(
                ip=node.ip,
                node_type=node.node_type,
                is_alive=node.is_alive,
                avg_rtt_ms=node.avg_rtt_ms,
                packet_loss=node.packet_loss,
            ))
        node_snapshots.sort(key=lambda n: n.ip)

        link_snapshots: List[LinkSnapshot] = []
        for link in builder.links:
            src_ip = builder.nodes.get(link.source, None).ip if builder.nodes.get(link.source) else link.source
            dst_ip = builder.nodes.get(link.target, None).ip if builder.nodes.get(link.target) else link.target
            link_id = f"{src_ip}->{dst_ip}"
            link_snapshots.append(LinkSnapshot(
                link_id=link_id,
                source_ip=src_ip,
                target_ip=dst_ip,
                quality_score=link.quality_score,
                avg_rtt_ms=link.avg_rtt_ms,
                packet_loss=link.packet_loss,
                jitter_ms=link.jitter_ms,
            ))
        link_snapshots.sort(key=lambda l: l.link_id)

        current_node_ips = {n.ip for n in node_snapshots}
        current_link_ids = {l.link_id for l in link_snapshots}

        changes = TopologyChanges(
            new_nodes=sorted(current_node_ips - self._prev_node_ips),
            disappeared_nodes=sorted(self._prev_node_ips - current_node_ips),
            new_links=sorted(current_link_ids - self._prev_link_ids),
            disappeared_links=sorted(self._prev_link_ids - current_link_ids),
        )

        self._prev_node_ips = current_node_ips
        self._prev_link_ids = current_link_ids

        duration = time.time() - start_time

        monitor_round = MonitorRound(
            round_number=round_number,
            timestamp=timestamp,
            nodes=node_snapshots,
            links=link_snapshots,
            changes=changes,
            alive_host_count=len(alive_hosts),
            duration_seconds=duration,
        )

        return monitor_round

    def _append_to_history(self, monitor_round: MonitorRound):
        history = self._load_history()
        history["rounds"].append(monitor_round.to_dict())
        history["last_updated"] = datetime.now().isoformat()
        self._save_history(history)

    def _load_history(self) -> dict:
        if os.path.exists(self.history_path):
            try:
                with open(self.history_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "rounds" not in data:
                        data["rounds"] = []
                    return data
            except (json.JSONDecodeError, OSError):
                pass
        return {
            "subnet": self.subnet,
            "config": {"interval": self.interval, "rounds": self.rounds},
            "rounds": [],
        }

    def _save_history(self, history: dict):
        history["subnet"] = self.subnet
        history["config"] = {"interval": self.interval, "rounds": self.rounds}
        os.makedirs(
            os.path.dirname(self.history_path) if os.path.dirname(self.history_path) else ".",
            exist_ok=True,
        )
        with open(self.history_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)

    def _seed_baseline_from_history(self):
        history = self._load_history()
        rounds = history.get("rounds", [])
        if not rounds:
            return
        last_round = rounds[-1]
        self._prev_node_ips = {n["ip"] for n in last_round.get("nodes", [])}
        self._prev_link_ids = {l["link_id"] for l in last_round.get("links", [])}

    def run(self, on_round_complete=None) -> List[MonitorRound]:
        self._seed_baseline_from_history()

        for r in range(1, self.rounds + 1):
            monitor_round = self._run_single_round(r)
            self.rounds_data.append(monitor_round)
            self._append_to_history(monitor_round)

            if on_round_complete:
                on_round_complete(monitor_round)

            if r < self.rounds:
                elapsed = monitor_round.duration_seconds
                sleep_time = max(0, self.interval - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)

        return self.rounds_data

    def compute_trend_summary(self) -> dict:
        link_scores: Dict[str, List[float]] = defaultdict(list)
        link_appearances: Dict[str, List[int]] = defaultdict(list)

        for rnd in self.rounds_data:
            present_links = {l.link_id for l in rnd.links}
            for link in rnd.links:
                link_scores[link.link_id].append(link.quality_score)
                link_appearances[link.link_id].append(rnd.round_number)
            for lid in set(link_scores.keys()) - present_links:
                link_scores[lid].append(None)

        link_volatility = []
        for link_id, scores in link_scores.items():
            valid_scores = [s for s in scores if s is not None]
            if len(valid_scores) < 2:
                continue
            score_stddev = statistics.pstdev(valid_scores) if len(valid_scores) >= 2 else 0.0
            score_range = max(valid_scores) - min(valid_scores)
            avg_score = sum(valid_scores) / len(valid_scores)
            appeared_rounds = link_appearances[link_id]
            missing_count = sum(1 for s in scores if s is None)
            link_volatility.append({
                "link_id": link_id,
                "score_stddev": round(score_stddev, 2),
                "score_range": round(score_range, 2),
                "avg_score": round(avg_score, 2),
                "min_score": round(min(valid_scores), 2),
                "max_score": round(max(valid_scores), 2),
                "appeared_rounds": appeared_rounds,
                "missing_rounds": missing_count,
            })

        link_volatility.sort(key=lambda x: x["score_stddev"], reverse=True)

        node_presence: Dict[str, List[int]] = defaultdict(list)
        node_offline_events: Dict[str, List[dict]] = defaultdict(list)

        for rnd in self.rounds_data:
            present_ips = {n.ip for n in rnd.nodes}
            for node in rnd.nodes:
                node_presence[node.ip].append(rnd.round_number)

            for ip in list(node_presence.keys()):
                if ip not in present_ips:
                    node_offline_events[ip].append({
                        "round": rnd.round_number,
                        "timestamp": rnd.timestamp,
                        "event": "disappeared",
                    })

        offline_nodes = []
        for ip, events in node_offline_events.items():
            if not events:
                continue
            appeared_in = node_presence[ip]
            offline_nodes.append({
                "ip": ip,
                "appeared_in_rounds": appeared_in,
                "offline_events": events,
                "offline_count": len(events),
            })
        offline_nodes.sort(key=lambda x: x["offline_count"], reverse=True)

        node_score_history = {}
        for rnd in self.rounds_data:
            for node in rnd.nodes:
                if node.ip not in node_score_history:
                    node_score_history[node.ip] = []
                node_score_history[node.ip].append({
                    "round": rnd.round_number,
                    "packet_loss": round(node.packet_loss, 2),
                    "avg_rtt_ms": round(node.avg_rtt_ms, 3),
                    "is_alive": node.is_alive,
                })

        return {
            "total_rounds": len(self.rounds_data),
            "link_volatility": link_volatility,
            "offline_nodes": offline_nodes,
            "node_history": node_score_history,
        }

    def render_trend_summary(self) -> str:
        summary = self.compute_trend_summary()
        lines = []
        lines.append("=" * 70)
        lines.append("  MONITORING TREND SUMMARY")
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"  Total rounds completed: {summary['total_rounds']}")
        lines.append(f"  Subnet monitored: {self.subnet}")
        lines.append("")

        lines.append("-" * 70)
        lines.append("  LINK QUALITY VOLATILITY (most fluctuating)")
        lines.append("-" * 70)
        volatility = summary["link_volatility"]
        if volatility:
            lines.append(f"  {'#':>3}  {'Link':<35} {'StdDev':>8} {'Range':>8} {'Avg':>6}")
            lines.append("  " + "-" * 66)
            for i, item in enumerate(volatility[:10]):
                lines.append(
                    f"  {i+1:>3}  {item['link_id']:<35} {item['score_stddev']:>8.2f} "
                    f"{item['score_range']:>8.2f} {item['avg_score']:>6.2f}"
                )
                lines.append(
                    f"        min={item['min_score']:.2f}  max={item['max_score']:.2f}  "
                    f"appeared_rounds={item['appeared_rounds']}  missing_rounds={item['missing_rounds']}"
                )
        else:
            lines.append("  No links with sufficient data to measure volatility.")
        lines.append("")

        lines.append("-" * 70)
        lines.append("  NODE OFFLINE EVENTS")
        lines.append("-" * 70)
        offline_nodes = summary["offline_nodes"]
        if offline_nodes:
            for item in offline_nodes:
                lines.append(f"  {item['ip']}")
                lines.append(
                    f"        offline_count={item['offline_count']}  "
                    f"appeared_in_rounds={item['appeared_in_rounds']}"
                )
                for evt in item["offline_events"]:
                    lines.append(
                        f"        - round {evt['round']} ({evt['timestamp']}): {evt['event']}"
                    )
        else:
            lines.append("  No nodes went offline during monitoring.")
        lines.append("")

        lines.append("-" * 70)
        lines.append("  PER-NODE HISTORY")
        lines.append("-" * 70)
        node_history = summary["node_history"]
        if node_history:
            for ip in sorted(node_history.keys()):
                history = node_history[ip]
                scores = [h["packet_loss"] for h in history]
                alive_flags = [h["is_alive"] for h in history]
                status = "OK" if all(alive_flags) else "UNSTABLE"
                lines.append(
                    f"  {ip:<18} rounds={len(history)}  status={status}  "
                    f"loss_range=[{min(scores):.2f}%, {max(scores):.2f}%]"
                )
        else:
            lines.append("  No node history available.")
        lines.append("")
        lines.append("=" * 70)
        return "\n".join(lines)

    def print_trend_summary(self):
        print(self.render_trend_summary())
