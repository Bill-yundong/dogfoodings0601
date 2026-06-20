#!/usr/bin/env python3
import sys
import os
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from topology.scanner import HostInfo
from topology.tracer import TracerouteProbe, TracerouteResult, HopInfo
from topology.monitor import TopologyMonitor


class FakeScanner:
    def __init__(self, rounds_data):
        self.rounds_data = rounds_data
        self._call_index = 0

    def scan_subnet(self, subnet):
        hosts = self.rounds_data[self._call_index]["hosts"]
        self._call_index += 1
        return hosts


class FakeTracer:
    def __init__(self, rounds_data):
        self.rounds_data = rounds_data
        self._call_index = 0

    def trace_multiple(self, targets):
        traces = self.rounds_data[self._call_index - 1]["traces"]
        return {ip: traces[ip] for ip in targets if ip in traces}


def make_hop(hop, ip, avg_rtt, loss=0.0, jitter=0.0):
    return HopInfo(
        hop=hop, ip=ip, avg_rtt_ms=avg_rtt, min_rtt_ms=avg_rtt - 0.2,
        max_rtt_ms=avg_rtt + 0.2, jitter_ms=jitter, packet_loss=loss,
        probes_sent=3, probes_received=3, rtt_ms=[avg_rtt],
    )


def build_round1_data():
    return {
        "hosts": [
            HostInfo(ip="192.168.1.1", alive=True, avg_rtt_ms=1.2),
            HostInfo(ip="192.168.1.10", alive=True, avg_rtt_ms=5.0),
            HostInfo(ip="192.168.1.20", alive=True, avg_rtt_ms=8.0),
        ],
        "traces": {
            "192.168.1.1": TracerouteResult(
                target="192.168.1.1", success=True, destination_reached=True,
                hops=[make_hop(1, "192.168.1.1", 1.2)],
            ),
            "192.168.1.10": TracerouteResult(
                target="192.168.1.10", success=True, destination_reached=True,
                hops=[make_hop(1, "192.168.1.1", 1.0), make_hop(2, "192.168.1.10", 5.0)],
            ),
            "192.168.1.20": TracerouteResult(
                target="192.168.1.20", success=True, destination_reached=True,
                hops=[
                    make_hop(1, "192.168.1.1", 1.0),
                    make_hop(2, "10.0.0.1", 3.0, loss=10.0, jitter=0.5),
                    make_hop(3, "192.168.1.20", 8.0, loss=5.0, jitter=1.0),
                ],
            ),
        },
    }


def build_round2_data():
    return {
        "hosts": [
            HostInfo(ip="192.168.1.1", alive=True, avg_rtt_ms=1.1),
            HostInfo(ip="192.168.1.10", alive=True, avg_rtt_ms=6.5),
        ],
        "traces": {
            "192.168.1.1": TracerouteResult(
                target="192.168.1.1", success=True, destination_reached=True,
                hops=[make_hop(1, "192.168.1.1", 1.1)],
            ),
            "192.168.1.10": TracerouteResult(
                target="192.168.1.10", success=True, destination_reached=True,
                hops=[
                    make_hop(1, "192.168.1.1", 1.0),
                    make_hop(2, "192.168.1.10", 6.5, loss=20.0, jitter=2.0),
                ],
            ),
        },
    }


def build_round3_data():
    return {
        "hosts": [
            HostInfo(ip="192.168.1.1", alive=True, avg_rtt_ms=1.3),
            HostInfo(ip="192.168.1.10", alive=True, avg_rtt_ms=4.8),
            HostInfo(ip="192.168.1.20", alive=True, avg_rtt_ms=9.5),
            HostInfo(ip="192.168.1.30", alive=True, avg_rtt_ms=12.0),
        ],
        "traces": {
            "192.168.1.1": TracerouteResult(
                target="192.168.1.1", success=True, destination_reached=True,
                hops=[make_hop(1, "192.168.1.1", 1.3)],
            ),
            "192.168.1.10": TracerouteResult(
                target="192.168.1.10", success=True, destination_reached=True,
                hops=[make_hop(1, "192.168.1.1", 1.0), make_hop(2, "192.168.1.10", 4.8)],
            ),
            "192.168.1.20": TracerouteResult(
                target="192.168.1.20", success=True, destination_reached=True,
                hops=[
                    make_hop(1, "192.168.1.1", 1.0),
                    make_hop(2, "10.0.0.1", 3.5, loss=0.0, jitter=0.3),
                    make_hop(3, "192.168.1.20", 9.5, loss=0.0, jitter=0.5),
                ],
            ),
            "192.168.1.30": TracerouteResult(
                target="192.168.1.30", success=True, destination_reached=True,
                hops=[
                    make_hop(1, "192.168.1.1", 1.0),
                    make_hop(2, "10.0.0.1", 3.0),
                    make_hop(3, "10.0.0.2", 7.0),
                    make_hop(4, "192.168.1.30", 12.0),
                ],
            ),
        },
    }


def main():
    print("\n" + "=" * 60)
    print("  MONITOR MODULE TEST")
    print("=" * 60 + "\n")

    tmpdir = tempfile.mkdtemp()
    history_path = os.path.join(tmpdir, "monitor_history.json")

    rounds_data = [build_round1_data(), build_round2_data(), build_round3_data()]

    scanner = FakeScanner(rounds_data)
    tracer = FakeTracer(rounds_data)

    monitor = TopologyMonitor(
        scanner=scanner,
        tracer=tracer,
        subnet="192.168.1.0/24",
        interval=0,
        rounds=3,
        history_path=history_path,
    )

    rounds = monitor.run()

    assert len(rounds) == 3, f"Expected 3 rounds, got {len(rounds)}"
    print("[OK] Ran 3 rounds")

    print(f"\n  Round 1 changes:")
    print(f"    new_nodes: {rounds[0].changes.new_nodes}")
    print(f"    new_links: {rounds[0].changes.new_links}")

    assert "192.168.1.1" in rounds[0].changes.new_nodes
    assert "192.168.1.20" in rounds[0].changes.new_nodes
    print("[OK] Round 1 detected all initial nodes as new")

    print(f"\n  Round 2 changes:")
    print(f"    new_nodes: {rounds[1].changes.new_nodes}")
    print(f"    disappeared_nodes: {rounds[1].changes.disappeared_nodes}")
    print(f"    disappeared_links: {rounds[1].changes.disappeared_links}")

    assert "192.168.1.20" in rounds[1].changes.disappeared_nodes, "192.168.1.20 should disappear in round 2"
    print("[OK] Round 2 detected 192.168.1.20 disappearance")

    print(f"\n  Round 3 changes:")
    print(f"    new_nodes: {rounds[2].changes.new_nodes}")
    print(f"    disappeared_nodes: {rounds[2].changes.disappeared_nodes}")

    assert "192.168.1.20" in rounds[2].changes.new_nodes, "192.168.1.20 should reappear in round 3"
    assert "192.168.1.30" in rounds[2].changes.new_nodes, "192.168.1.30 should be new in round 3"
    print("[OK] Round 3 detected 192.168.1.20 reappearance and 192.168.1.30 new")

    with open(history_path, "r", encoding="utf-8") as f:
        history = json.load(f)

    assert history["subnet"] == "192.168.1.0/24"
    assert len(history["rounds"]) == 3
    assert "timestamp" in history["rounds"][0]
    print("\n[OK] History file contains 3 rounds with timestamps")

    print(f"\n  History structure keys: {list(history.keys())}")
    print(f"  Round 1 keys: {list(history['rounds'][0].keys())}")
    print(f"  Round 1 node count: {len(history['rounds'][0]['nodes'])}")
    print(f"  Round 1 link count: {len(history['rounds'][0]['links'])}")

    summary = monitor.compute_trend_summary()
    print(f"\n  Trend summary keys: {list(summary.keys())}")
    print(f"  Total rounds: {summary['total_rounds']}")

    volatility = summary["link_volatility"]
    print(f"  Volatile links: {len(volatility)}")
    for v in volatility:
        print(f"    {v['link_id']}: stddev={v['score_stddev']}, range={v['score_range']}, avg={v['avg_score']}")

    assert len(volatility) > 0, "Should have volatile links"
    top_link = volatility[0]
    print(f"\n[OK] Most volatile link: {top_link['link_id']} (stddev={top_link['score_stddev']})")

    offline_nodes = summary["offline_nodes"]
    print(f"\n  Offline nodes: {len(offline_nodes)}")
    for n in offline_nodes:
        print(f"    {n['ip']}: offline_count={n['offline_count']}, events={n['offline_events']}")

    assert any(n["ip"] == "192.168.1.20" for n in offline_nodes), "192.168.1.20 should have offline events"
    print("[OK] 192.168.1.20 correctly flagged as having gone offline")

    print("\n" + "=" * 60)
    print("  RENDERED TREND SUMMARY")
    print("=" * 60)
    print(monitor.render_trend_summary())

    with open(history_path, "r", encoding="utf-8") as f:
        history_after = json.load(f)
    assert len(history_after["rounds"]) == 3
    print("[OK] History file preserved after trend summary")

    monitor2 = TopologyMonitor(
        scanner=FakeScanner([build_round1_data()]),
        tracer=FakeTracer([build_round1_data()]),
        subnet="192.168.1.0/24",
        interval=0,
        rounds=1,
        history_path=history_path,
    )
    monitor2.run()
    with open(history_path, "r", encoding="utf-8") as f:
        history_appended = json.load(f)
    assert len(history_appended["rounds"]) == 4, "Should append to existing history"
    print(f"\n[OK] Append to existing history works (now {len(history_appended['rounds'])} rounds)")

    import shutil
    shutil.rmtree(tmpdir)
    print("\n  Cleaned up temp dir")

    print("\n" + "=" * 60)
    print("  ALL MONITOR TESTS PASSED")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
