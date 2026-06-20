import json
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict


@dataclass
class TopologyNode:
    id: str
    ip: str
    hostname: str = ""
    node_type: str = "router"
    is_alive: bool = True
    avg_rtt_ms: float = 0.0
    min_rtt_ms: float = 0.0
    max_rtt_ms: float = 0.0
    packet_loss: float = 0.0
    hop_count: int = 0


@dataclass
class TopologyLink:
    source: str
    target: str
    avg_rtt_ms: float = 0.0
    min_rtt_ms: float = 0.0
    max_rtt_ms: float = 0.0
    jitter_ms: float = 0.0
    packet_loss: float = 0.0
    quality_score: float = 0.0
    sample_count: int = 0


class TopologyBuilder:
    def __init__(self):
        self.nodes: Dict[str, TopologyNode] = {}
        self.links: List[TopologyLink] = []
        self._adjacency: Dict[str, List[str]] = defaultdict(list)
        self._reverse_adjacency: Dict[str, List[str]] = defaultdict(list)
        self._link_map: Dict[Tuple[str, str], TopologyLink] = {}

    def add_node(self, node: TopologyNode):
        if node.id not in self.nodes:
            self.nodes[node.id] = node

    def add_link(self, source: str, target: str, link: Optional[TopologyLink] = None):
        key = (source, target)
        if key not in self._link_map:
            if link is None:
                link = TopologyLink(source=source, target=target)
            self._link_map[key] = link
            self.links.append(link)
            self._adjacency[source].append(target)
            self._reverse_adjacency[target].append(source)
        return self._link_map[key]

    def build_from_traceroute_results(self, traceroute_results: Dict, host_infos: List = None):
        target_nodes = set()

        for target, trace_result in traceroute_results.items():
            target_nodes.add(target)
            prev_ip = None
            prev_hop_idx = -1

            for hop in trace_result.hops:
                if hop.ip == "*" or not hop.ip:
                    continue

                node_id = f"node_{hop.ip}"
                if node_id not in self.nodes:
                    node = TopologyNode(
                        id=node_id,
                        ip=hop.ip,
                        avg_rtt_ms=hop.avg_rtt_ms,
                        min_rtt_ms=hop.min_rtt_ms,
                        max_rtt_ms=hop.max_rtt_ms,
                        packet_loss=hop.packet_loss,
                        hop_count=hop.hop,
                        is_alive=hop.avg_rtt_ms > 0,
                    )
                    self.add_node(node)

                if prev_ip is not None and prev_hop_idx >= 0:
                    src_id = f"node_{prev_ip}"
                    dst_id = f"node_{hop.ip}"
                    link_key = (src_id, dst_id)

                    if link_key not in self._link_map:
                        link = TopologyLink(
                            source=src_id,
                            target=dst_id,
                            avg_rtt_ms=hop.avg_rtt_ms,
                            min_rtt_ms=hop.min_rtt_ms,
                            max_rtt_ms=hop.max_rtt_ms,
                            jitter_ms=hop.jitter_ms,
                            packet_loss=hop.packet_loss,
                            sample_count=1,
                        )
                        self.add_link(src_id, dst_id, link)
                    else:
                        existing = self._link_map[link_key]
                        existing.sample_count += 1
                        existing.avg_rtt_ms = (
                            existing.avg_rtt_ms * (existing.sample_count - 1) + hop.avg_rtt_ms
                        ) / existing.sample_count
                        existing.min_rtt_ms = min(existing.min_rtt_ms, hop.min_rtt_ms)
                        existing.max_rtt_ms = max(existing.max_rtt_ms, hop.max_rtt_ms)
                        existing.jitter_ms = max(existing.jitter_ms, hop.jitter_ms)
                        existing.packet_loss = (
                            existing.packet_loss * (existing.sample_count - 1) + hop.packet_loss
                        ) / existing.sample_count

                prev_ip = hop.ip
                prev_hop_idx = hop.hop

        if host_infos:
            for host in host_infos:
                node_id = f"node_{host.ip}"
                if node_id in self.nodes:
                    self.nodes[node_id].node_type = "endpoint"
                    self.nodes[node_id].avg_rtt_ms = host.avg_rtt_ms
                    self.nodes[node_id].min_rtt_ms = host.min_rtt_ms
                    self.nodes[node_id].max_rtt_ms = host.max_rtt_ms
                    self.nodes[node_id].packet_loss = host.packet_loss

        self._compute_quality_scores()

    def _compute_quality_scores(self):
        for link in self.links:
            rtt_score = max(0, 100 - link.avg_rtt_ms)
            loss_score = max(0, 100 - link.packet_loss * 2)
            jitter_score = max(0, 100 - link.jitter_ms * 5)
            link.quality_score = (rtt_score * 0.4 + loss_score * 0.4 + jitter_score * 0.2)

    def find_single_points_of_failure(self) -> List[str]:
        if not self.nodes:
            return []

        all_nodes = set(self.nodes.keys())
        spofs = []

        entry_nodes = self._find_entry_nodes()
        if not entry_nodes:
            entry_nodes = {list(self.nodes.keys())[0]}

        for node_id in all_nodes:
            if node_id in entry_nodes:
                continue

            reachable_without = set()
            for entry in entry_nodes:
                if entry == node_id:
                    continue
                reachable = self._bfs_reachable(entry, exclude_node=node_id)
                reachable_without.update(reachable)

            all_endpoints = {
                nid for nid, n in self.nodes.items()
                if n.node_type == "endpoint" and nid != node_id
            }

            if all_endpoints and not all_endpoints.issubset(reachable_without):
                spofs.append(node_id)

        return spofs

    def _find_entry_nodes(self) -> Set[str]:
        entries = set()
        for node_id, node in self.nodes.items():
            if node.hop_count == 1 or len(self._reverse_adjacency.get(node_id, [])) == 0:
                entries.add(node_id)
        return entries

    def _bfs_reachable(self, start: str, exclude_node: str = None) -> Set[str]:
        visited = set()
        queue = [start]
        visited.add(start)

        while queue:
            current = queue.pop(0)
            for neighbor in self._adjacency.get(current, []):
                if neighbor not in visited and neighbor != exclude_node:
                    visited.add(neighbor)
                    queue.append(neighbor)
        return visited

    def detect_cycles(self) -> List[List[str]]:
        cycles = []
        visited = set()
        path = []
        path_set = set()

        def dfs(node: str):
            if node in path_set:
                idx = path.index(node)
                cycle = path[idx:]
                cycles.append(cycle + [node])
                return

            if node in visited:
                return

            visited.add(node)
            path.append(node)
            path_set.add(node)

            for neighbor in self._adjacency.get(node, []):
                dfs(neighbor)

            path.pop()
            path_set.remove(node)

        for node_id in self.nodes:
            if node_id not in visited:
                dfs(node_id)

        unique_cycles = []
        seen = set()
        for cycle in cycles:
            normalized = tuple(sorted(cycle[:-1]))
            if normalized not in seen:
                seen.add(normalized)
                unique_cycles.append(cycle)

        return unique_cycles

    def get_neighbors(self, node_id: str) -> List[str]:
        return self._adjacency.get(node_id, [])

    def get_incoming_neighbors(self, node_id: str) -> List[str]:
        return self._reverse_adjacency.get(node_id, [])

    def to_dict(self) -> dict:
        return {
            "nodes": [
                {
                    "id": n.id,
                    "ip": n.ip,
                    "hostname": n.hostname,
                    "node_type": n.node_type,
                    "is_alive": n.is_alive,
                    "avg_rtt_ms": round(n.avg_rtt_ms, 3),
                    "min_rtt_ms": round(n.min_rtt_ms, 3),
                    "max_rtt_ms": round(n.max_rtt_ms, 3),
                    "packet_loss": round(n.packet_loss, 2),
                    "hop_count": n.hop_count,
                }
                for n in self.nodes.values()
            ],
            "links": [
                {
                    "source": l.source,
                    "target": l.target,
                    "avg_rtt_ms": round(l.avg_rtt_ms, 3),
                    "min_rtt_ms": round(l.min_rtt_ms, 3),
                    "max_rtt_ms": round(l.max_rtt_ms, 3),
                    "jitter_ms": round(l.jitter_ms, 3),
                    "packet_loss": round(l.packet_loss, 2),
                    "quality_score": round(l.quality_score, 2),
                    "sample_count": l.sample_count,
                }
                for l in self.links
            ],
            "stats": {
                "node_count": len(self.nodes),
                "link_count": len(self.links),
                "single_points_of_failure": [
                    {"id": nid, "ip": self.nodes[nid].ip}
                    for nid in self.find_single_points_of_failure()
                ],
                "cycles": [
                    [{"id": nid, "ip": self.nodes[nid].ip if nid in self.nodes else nid} for nid in cycle]
                    for cycle in self.detect_cycles()
                ],
            },
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
