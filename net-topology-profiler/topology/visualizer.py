import json
import os
from typing import Dict, List, Optional
from collections import defaultdict


class TopologyVisualizer:
    def __init__(self, topology_builder=None, quality_analyzer=None):
        self.builder = topology_builder
        self.analyzer = quality_analyzer
        self._quality_colors = {
            "excellent": "\033[92m",
            "good": "\033[92m",
            "fair": "\033[93m",
            "poor": "\033[91m",
            "critical": "\033[91m",
            "unknown": "\033[90m",
        }
        self._reset_color = "\033[0m"

    def _get_quality_color(self, quality_grade: str) -> str:
        return self._quality_colors.get(quality_grade, "\033[90m")

    def _quality_bar(self, score: float, width: int = 20) -> str:
        filled = int(width * score / 100)
        filled = max(0, min(filled, width))
        bar = "█" * filled + "░" * (width - filled)

        if score >= 90:
            color = "\033[92m"
        elif score >= 75:
            color = "\033[92m"
        elif score >= 60:
            color = "\033[93m"
        elif score >= 40:
            color = "\033[91m"
        else:
            color = "\033[91m"

        return f"{color}{bar}{self._reset_color}"

    def render_ascii_topology(self) -> str:
        if not self.builder or not self.builder.nodes:
            return "No topology data available."

        lines = []
        lines.append("=" * 70)
        lines.append("  NETWORK TOPOLOGY GRAPH")
        lines.append("=" * 70)
        lines.append("")

        spofs = set(self.builder.find_single_points_of_failure())
        cycles = self.builder.detect_cycles()

        node_levels = self._compute_hierarchy_levels()

        max_level = max(node_levels.values()) if node_levels else 0

        for level in range(1, max_level + 1):
            level_nodes = [nid for nid, lvl in node_levels.items() if lvl == level]
            level_nodes.sort(key=lambda nid: self.builder.nodes[nid].ip)

            lines.append(f"  Level {level}:")

            for nid in level_nodes:
                node = self.builder.nodes[nid]
                marker = ""
                if nid in spofs:
                    marker = " ⚠️  [SPOF]"
                if node.node_type == "endpoint":
                    marker += " ◉"

                node_str = f"    {node.ip} [{node.node_type}]{marker}"
                lines.append(node_str)

                neighbors = self.builder.get_neighbors(nid)
                for neighbor_id in neighbors:
                    neighbor = self.builder.nodes.get(neighbor_id)
                    if not neighbor:
                        continue

                    link_key = (nid, neighbor_id)
                    link = self.builder._link_map.get(link_key)

                    if link:
                        quality_str = f"score={link.quality_score:.1f}"
                        latency_str = f"{link.avg_rtt_ms:.2f}ms"
                        loss_str = f"{link.packet_loss:.1f}%"
                    else:
                        quality_str = "score=?"
                        latency_str = "?ms"
                        loss_str = "?%"

                    bar = self._quality_bar(link.quality_score if link else 0)

                    lines.append(f"      └──▶ {neighbor.ip}")
                    lines.append(f"           {bar} {quality_str}")
                    lines.append(f"           latency={latency_str}  loss={loss_str}")

            lines.append("")

        if spofs:
            lines.append("  ⚠️  Single Points of Failure:")
            for nid in spofs:
                node = self.builder.nodes[nid]
                lines.append(f"    - {node.ip} ({node.node_type})")
            lines.append("")

        if cycles:
            lines.append("  🔄 Detected Cycles:")
            for i, cycle in enumerate(cycles):
                cycle_ips = [
                    self.builder.nodes[nid].ip if nid in self.builder.nodes else nid
                    for nid in cycle
                ]
                lines.append(f"    Cycle #{i + 1}: {' → '.join(cycle_ips)}")
            lines.append("")

        lines.append("=" * 70)
        return "\n".join(lines)

    def _compute_hierarchy_levels(self) -> Dict[str, int]:
        if not self.builder or not self.builder.nodes:
            return {}

        levels = {}
        entry_nodes = self.builder._find_entry_nodes()

        if not entry_nodes:
            first_node = list(self.builder.nodes.keys())[0]
            entry_nodes = {first_node}

        for entry in entry_nodes:
            queue = [(entry, 1)]
            visited = set()

            while queue:
                node_id, level = queue.pop(0)
                if node_id in visited:
                    continue
                visited.add(node_id)

                if node_id not in levels or levels[node_id] > level:
                    levels[node_id] = level

                for neighbor in self.builder.get_neighbors(node_id):
                    if neighbor not in visited:
                        queue.append((neighbor, level + 1))

        for node_id in self.builder.nodes:
            if node_id not in levels:
                levels[node_id] = 99

        return levels

    def render_quality_report(self) -> str:
        if not self.analyzer:
            return "No quality data available."

        lines = []
        lines.append("=" * 70)
        lines.append("  LINK QUALITY PROFILE REPORT")
        lines.append("=" * 70)
        lines.append("")

        summary = self.analyzer.get_overall_summary()
        lines.append(f"  Total Links Analyzed: {summary['total_links']}")
        lines.append(f"  Average Quality Score: {summary['average_quality_score']:.2f}")
        lines.append(f"  Average Latency: {summary['average_latency_ms']:.3f} ms")
        lines.append(f"  Average Packet Loss: {summary['average_packet_loss']:.3f}%")
        lines.append(f"  Average Jitter: {summary['average_jitter_ms']:.3f} ms")
        lines.append("")

        lines.append("  Quality Grade Distribution:")
        for grade, count in summary.get("quality_grade_distribution", {}).items():
            color = self._get_quality_color(grade)
            lines.append(f"    {color}{grade:12s}{self._reset_color}: {count} links")
        lines.append("")

        lines.append("-" * 70)
        lines.append("  LINK DETAILS")
        lines.append("-" * 70)
        lines.append("")

        sorted_links = sorted(
            self.analyzer.link_metrics.values(),
            key=lambda m: m.quality_score,
            reverse=True,
        )

        for i, metrics in enumerate(sorted_links):
            color = self._get_quality_color(metrics.quality_grade)
            bar = self._quality_bar(metrics.quality_score)

            lines.append(f"  [{i + 1}] {metrics.source} → {metrics.target}")
            lines.append(f"      Quality: {color}{metrics.quality_grade.upper()}{self._reset_color}  {bar} {metrics.quality_score:.1f}/100")
            lines.append(f"      Latency: avg={metrics.avg_latency_ms:.3f}ms  min={metrics.min_latency_ms:.3f}ms  max={metrics.max_latency_ms:.3f}ms")
            lines.append(f"      Jitter: {metrics.jitter_ms:.3f}ms  StdDev: {metrics.latency_stddev_ms:.3f}ms")
            lines.append(f"      Packet Loss: {metrics.packet_loss_rate:.3f}%")

            if metrics.latency_percentiles:
                pct_str = "  ".join(f"{k}={v:.2f}ms" for k, v in metrics.latency_percentiles.items())
                lines.append(f"      Percentiles: {pct_str}")

            lines.append(f"      Samples: {metrics.sample_count}")
            lines.append("")

        lines.append("=" * 70)
        return "\n".join(lines)

    def export_json(self, output_path: str, subnet: str = ""):
        if not self.builder:
            return False

        data = {
            "metadata": {
                "subnet": subnet,
                "generated_at": "",
                "tool": "net-topology-profiler",
            },
            "topology": self.builder.to_dict(),
        }

        if self.analyzer:
            data["quality_profile"] = self.analyzer.to_dict()

        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return True

    def print_full_report(self):
        print(self.render_ascii_topology())
        print()
        print(self.render_quality_report())
