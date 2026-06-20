#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from topology.scanner import NetworkScanner, HostInfo
from topology.tracer import TracerouteProbe, TracerouteResult, HopInfo
from topology.builder import TopologyBuilder, TopologyNode, TopologyLink
from topology.analyzer import LinkQualityAnalyzer, LinkQualityMetrics
from topology.visualizer import TopologyVisualizer


def test_scanner():
    print("=" * 50)
    print("Testing NetworkScanner...")
    print("=" * 50)

    scanner = NetworkScanner(max_workers=5, timeout=1, packets=2)

    host = scanner.ping_host("127.0.0.1")
    print(f"Ping localhost: ip={host.ip}, alive={host.alive}, rtt={host.avg_rtt_ms:.2f}ms")

    print("✓ NetworkScanner test passed\n")


def test_tracer():
    print("=" * 50)
    print("Testing TracerouteProbe...")
    print("=" * 50)

    tracer = TracerouteProbe(max_hops=5, probes_per_hop=2, timeout=1)

    result = tracer.trace("127.0.0.1")
    print(f"Traceroute to localhost: target={result.target}, success={result.success}, hops={len(result.hops)}")

    print("✓ TracerouteProbe test passed\n")


def test_builder():
    print("=" * 50)
    print("Testing TopologyBuilder...")
    print("=" * 50)

    builder = TopologyBuilder()

    trace_results = {}

    result1 = TracerouteResult(target="192.168.1.10")
    result1.success = True
    result1.hops = [
        HopInfo(hop=1, ip="192.168.1.1", avg_rtt_ms=1.5, min_rtt_ms=1.2, max_rtt_ms=1.8, jitter_ms=0.6, packet_loss=0.0, probes_sent=3, probes_received=3),
        HopInfo(hop=2, ip="192.168.1.10", avg_rtt_ms=5.2, min_rtt_ms=4.8, max_rtt_ms=5.6, jitter_ms=0.8, packet_loss=0.0, probes_sent=3, probes_received=3),
    ]
    trace_results["192.168.1.10"] = result1

    result2 = TracerouteResult(target="192.168.1.20")
    result2.success = True
    result2.hops = [
        HopInfo(hop=1, ip="192.168.1.1", avg_rtt_ms=1.3, min_rtt_ms=1.1, max_rtt_ms=1.5, jitter_ms=0.4, packet_loss=0.0, probes_sent=3, probes_received=3),
        HopInfo(hop=2, ip="10.0.0.1", avg_rtt_ms=3.1, min_rtt_ms=2.8, max_rtt_ms=3.4, jitter_ms=0.6, packet_loss=10.0, probes_sent=3, probes_received=2),
        HopInfo(hop=3, ip="192.168.1.20", avg_rtt_ms=8.5, min_rtt_ms=7.9, max_rtt_ms=9.1, jitter_ms=1.2, packet_loss=5.0, probes_sent=3, probes_received=3),
    ]
    trace_results["192.168.1.20"] = result2

    host_infos = [
        HostInfo(ip="192.168.1.10", alive=True, avg_rtt_ms=5.2),
        HostInfo(ip="192.168.1.20", alive=True, avg_rtt_ms=8.5),
    ]

    builder.build_from_traceroute_results(trace_results, host_infos)

    print(f"Nodes: {len(builder.nodes)}")
    print(f"Links: {len(builder.links)}")

    for nid, node in builder.nodes.items():
        print(f"  Node: {node.ip} ({node.node_type})")

    for link in builder.links:
        src = builder.nodes.get(link.source)
        dst = builder.nodes.get(link.target)
        print(f"  Link: {src.ip if src else link.source} -> {dst.ip if dst else link.target} (score: {link.quality_score:.1f})")

    spofs = builder.find_single_points_of_failure()
    print(f"SPOFs: {len(spofs)}")
    for spof in spofs:
        print(f"  - {builder.nodes[spof].ip}")

    cycles = builder.detect_cycles()
    print(f"Cycles: {len(cycles)}")

    topo_dict = builder.to_dict()
    print(f"JSON keys: {list(topo_dict.keys())}")

    print("✓ TopologyBuilder test passed\n")
    return builder


def test_analyzer():
    print("=" * 50)
    print("Testing LinkQualityAnalyzer...")
    print("=" * 50)

    analyzer = LinkQualityAnalyzer()

    result1 = TracerouteResult(target="192.168.1.10")
    result1.hops = [
        HopInfo(hop=1, ip="192.168.1.1", avg_rtt_ms=1.5, min_rtt_ms=1.2, max_rtt_ms=1.8, jitter_ms=0.6, packet_loss=0.0, rtt_ms=[1.2, 1.5, 1.8]),
        HopInfo(hop=2, ip="192.168.1.10", avg_rtt_ms=5.2, min_rtt_ms=4.8, max_rtt_ms=5.6, jitter_ms=0.8, packet_loss=0.0, rtt_ms=[4.8, 5.2, 5.6]),
    ]
    analyzer.add_traceroute_result("192.168.1.10", result1)

    result2 = TracerouteResult(target="192.168.1.20")
    result2.hops = [
        HopInfo(hop=1, ip="192.168.1.1", avg_rtt_ms=1.3, min_rtt_ms=1.1, max_rtt_ms=1.5, jitter_ms=0.4, packet_loss=0.0, rtt_ms=[1.1, 1.3, 1.5]),
        HopInfo(hop=2, ip="10.0.0.1", avg_rtt_ms=3.1, min_rtt_ms=2.8, max_rtt_ms=3.4, jitter_ms=0.6, packet_loss=10.0, rtt_ms=[2.8, 3.1, 3.4]),
        HopInfo(hop=3, ip="192.168.1.20", avg_rtt_ms=8.5, min_rtt_ms=7.9, max_rtt_ms=9.1, jitter_ms=1.2, packet_loss=5.0, rtt_ms=[7.9, 8.5, 9.1]),
    ]
    analyzer.add_traceroute_result("192.168.1.20", result2)

    analyzer.analyze_all()

    print(f"Links analyzed: {len(analyzer.link_metrics)}")

    summary = analyzer.get_overall_summary()
    print(f"Summary: avg_score={summary['average_quality_score']:.2f}")

    for link_id, metrics in analyzer.link_metrics.items():
        print(f"  {link_id}: score={metrics.quality_score:.1f}, grade={metrics.quality_grade}")
        print(f"    latency: avg={metrics.avg_latency_ms:.3f}ms, jitter={metrics.jitter_ms:.3f}ms, loss={metrics.packet_loss_rate:.2f}%")
        if metrics.latency_percentiles:
            print(f"    percentiles: {metrics.latency_percentiles}")

    print("✓ LinkQualityAnalyzer test passed\n")
    return analyzer


def test_visualizer(builder, analyzer):
    print("=" * 50)
    print("Testing TopologyVisualizer...")
    print("=" * 50)

    visualizer = TopologyVisualizer(topology_builder=builder, quality_analyzer=analyzer)

    ascii_topo = visualizer.render_ascii_topology()
    print("ASCII Topology Preview:")
    print(ascii_topo[:500] + "..." if len(ascii_topo) > 500 else ascii_topo)

    quality_report = visualizer.render_quality_report()
    print("\nQuality Report Preview:")
    print(quality_report[:500] + "..." if len(quality_report) > 500 else quality_report)

    test_output = "/tmp/test_topology.json"
    visualizer.export_json(test_output, subnet="192.168.1.0/24")
    print(f"\nExported to: {test_output}")

    import json
    with open(test_output) as f:
        data = json.load(f)
    print(f"JSON keys: {list(data.keys())}")
    print(f"Topology nodes: {len(data['topology']['nodes'])}")
    print(f"Quality links: {len(data['quality_profile']['links'])}")

    os.remove(test_output)
    print("Cleaned up test file")

    print("✓ TopologyVisualizer test passed\n")


def main():
    print("\n" + "=" * 60)
    print("  NETWORK TOPOLOGY PROFILER - UNIT TESTS")
    print("=" * 60 + "\n")

    try:
        test_scanner()
        test_tracer()
        builder = test_builder()
        analyzer = test_analyzer()
        test_visualizer(builder, analyzer)

        print("=" * 60)
        print("  ALL TESTS PASSED ✓")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
