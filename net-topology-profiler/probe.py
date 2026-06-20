#!/usr/bin/env python3
import argparse
import sys
import os
import json
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from topology.scanner import NetworkScanner
from topology.tracer import TracerouteProbe
from topology.builder import TopologyBuilder
from topology.analyzer import LinkQualityAnalyzer
from topology.visualizer import TopologyVisualizer


def cmd_scan(args):
    subnet = args.subnet
    output = args.output or f"topology_{subnet.replace('/', '_')}.json"
    max_workers = args.max_workers
    ping_count = args.ping_count
    timeout = args.timeout
    max_hops = args.max_hops

    print(f"\n{'='*60}")
    print(f"  Network Topology Profiler")
    print(f"{'='*60}")
    print(f"\n[*] Scanning subnet: {subnet}")
    print(f"[*] Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    scanner = NetworkScanner(max_workers=max_workers, timeout=timeout, packets=ping_count)

    print("[1/4] Performing ICMP host discovery...")
    print("-" * 60)

    start_time = time.time()
    alive_hosts = scanner.scan_subnet(subnet)
    scan_time = time.time() - start_time

    print(f"\n[+] Found {len(alive_hosts)} alive host(s) in {scan_time:.2f}s")

    if not alive_hosts:
        print("\n[!] No alive hosts found. Exiting.")
        return 1

    for host in alive_hosts:
        status = "✓" if host.alive else "✗"
        print(f"    {status} {host.ip:15s}  RTT: {host.avg_rtt_ms:8.2f}ms  Loss: {host.packet_loss:5.1f}%")

    print()
    print("[2/4] Running traceroute on discovered hosts...")
    print("-" * 60)

    tracer = TracerouteProbe(max_hops=max_hops, probes_per_hop=ping_count, timeout=timeout, max_workers=max_workers)
    target_ips = [h.ip for h in alive_hosts]

    start_time = time.time()
    trace_results = tracer.trace_multiple(target_ips)
    trace_time = time.time() - start_time

    print(f"\n[+] Traceroute completed in {trace_time:.2f}s")

    successful_traces = sum(1 for r in trace_results.values() if r.success)
    print(f"    Successful: {successful_traces}/{len(trace_results)}")
    print()

    print("[3/4] Building topology graph...")
    print("-" * 60)

    builder = TopologyBuilder()
    builder.build_from_traceroute_results(trace_results, alive_hosts)

    print(f"\n[+] Topology built:")
    print(f"    Nodes: {len(builder.nodes)}")
    print(f"    Links: {len(builder.links)}")

    spofs = builder.find_single_points_of_failure()
    if spofs:
        print(f"    Single Points of Failure: {len(spofs)}")
        for nid in spofs:
            print(f"      - {builder.nodes[nid].ip}")
    else:
        print(f"    Single Points of Failure: None")

    cycles = builder.detect_cycles()
    if cycles:
        print(f"    Cycles detected: {len(cycles)}")
    else:
        print(f"    Cycles detected: None")

    print()
    print("[4/4] Analyzing link quality profile...")
    print("-" * 60)

    analyzer = LinkQualityAnalyzer()
    for target, result in trace_results.items():
        analyzer.add_traceroute_result(target, result)
    analyzer.analyze_all()

    summary = analyzer.get_overall_summary()
    print(f"\n[+] Quality Analysis Summary:")
    print(f"    Links analyzed: {summary['total_links']}")
    print(f"    Avg quality score: {summary['average_quality_score']:.2f}")
    print(f"    Avg latency: {summary['average_latency_ms']:.3f} ms")
    print(f"    Avg packet loss: {summary['average_packet_loss']:.3f}%")
    print(f"    Avg jitter: {summary['average_jitter_ms']:.3f} ms")
    print()

    visualizer = TopologyVisualizer(topology_builder=builder, quality_analyzer=analyzer)

    print("\n" + "=" * 60)
    print("  VISUALIZATION")
    print("=" * 60)

    print()
    print(visualizer.render_ascii_topology())
    print()
    print(visualizer.render_quality_report())

    print(f"\n[*] Exporting topology to: {output}")
    visualizer.export_json(output, subnet=subnet)

    with open(output, "r") as f:
        data = json.load(f)
        data["metadata"]["generated_at"] = datetime.now().isoformat()
        data["metadata"]["scan_duration_seconds"] = round(scan_time + trace_time, 2)
        data["metadata"]["hosts_discovered"] = len(alive_hosts)
    with open(output, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[+] Export complete!")
    print(f"\n[*] Total time: {scan_time + trace_time:.2f}s")
    print(f"[*] End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    return 0


def cmd_view(args):
    filepath = args.file

    if not os.path.exists(filepath):
        print(f"[!] File not found: {filepath}")
        return 1

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"\n{'='*60}")
    print(f"  Topology Report: {filepath}")
    print(f"{'='*60}")

    if "metadata" in data:
        meta = data["metadata"]
        print(f"\n  Subnet: {meta.get('subnet', 'N/A')}")
        print(f"  Generated: {meta.get('generated_at', 'N/A')}")
        print(f"  Hosts discovered: {meta.get('hosts_discovered', 'N/A')}")
        print()

    if "topology" in data:
        topo = data["topology"]
        print(f"  Nodes: {len(topo.get('nodes', []))}")
        print(f"  Links: {len(topo.get('links', []))}")

        stats = topo.get("stats", {})
        spofs = stats.get("single_points_of_failure", [])
        cycles = stats.get("cycles", [])
        print(f"  SPOFs: {len(spofs)}")
        print(f"  Cycles: {len(cycles)}")
        print()

        print("-" * 60)
        print("  NODES")
        print("-" * 60)
        for node in topo.get("nodes", []):
            marker = ""
            if node.get("node_type") == "endpoint":
                marker = " [endpoint]"
            print(f"  {node['ip']:15s} type={node.get('node_type', '?'):10s} {marker}")
            print(f"    RTT: avg={node.get('avg_rtt_ms', 0):.2f}ms  loss={node.get('packet_loss', 0):.1f}%")

        print()
        print("-" * 60)
        print("  LINKS")
        print("-" * 60)
        for link in topo.get("links", []):
            src_ip = next((n["ip"] for n in topo.get("nodes", []) if n["id"] == link["source"]), link["source"])
            dst_ip = next((n["ip"] for n in topo.get("nodes", []) if n["id"] == link["target"]), link["target"])
            print(f"  {src_ip:15s} → {dst_ip:15s}")
            print(f"    RTT: {link.get('avg_rtt_ms', 0):.2f}ms  Jitter: {link.get('jitter_ms', 0):.2f}ms  Loss: {link.get('packet_loss', 0):.1f}%")
            print(f"    Quality Score: {link.get('quality_score', 0):.1f}/100")

    if "quality_profile" in data:
        qp = data["quality_profile"]
        print()
        print("-" * 60)
        print("  QUALITY PROFILE SUMMARY")
        print("-" * 60)
        summary = qp.get("summary", {})
        for k, v in summary.items():
            print(f"  {k}: {v}")

    print()
    return 0


def cmd_analyze(args):
    filepath = args.file

    if not os.path.exists(filepath):
        print(f"[!] File not found: {filepath}")
        return 1

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "quality_profile" not in data:
        print("[!] No quality profile data in this file.")
        return 1

    qp = data["quality_profile"]

    print(f"\n{'='*60}")
    print(f"  Link Quality Analysis Report")
    print(f"{'='*60}")

    summary = qp.get("summary", {})
    print(f"\n  Total Links: {summary.get('total_links', 0)}")
    print(f"  Average Quality Score: {summary.get('average_quality_score', 0):.2f}")
    print(f"  Average Latency: {summary.get('average_latency_ms', 0):.3f} ms")
    print(f"  Average Packet Loss: {summary.get('average_packet_loss', 0):.3f}%")
    print(f"  Average Jitter: {summary.get('average_jitter_ms', 0):.3f} ms")
    print()

    grade_dist = summary.get("quality_grade_distribution", {})
    print("  Quality Grade Distribution:")
    for grade in ["excellent", "good", "fair", "poor", "critical"]:
        count = grade_dist.get(grade, 0)
        bar = "█" * count
        print(f"    {grade:12s}: {count:3d}  {bar}")
    print()

    print("-" * 60)
    print("  LINK DETAILS (sorted by quality score)")
    print("-" * 60)
    print()

    links = sorted(qp.get("links", []), key=lambda x: x.get("quality_score", 0), reverse=True)

    for i, link in enumerate(links):
        score = link.get("quality_score", 0)
        grade = link.get("quality_grade", "unknown")
        print(f"  [{i+1}] {link['source']} → {link['target']}")
        print(f"      Score: {score:.1f}/100  Grade: {grade.upper()}")
        print(f"      Latency: avg={link.get('avg_latency_ms', 0):.3f}ms  min={link.get('min_latency_ms', 0):.3f}ms  max={link.get('max_latency_ms', 0):.3f}ms")
        print(f"      Jitter: {link.get('jitter_ms', 0):.3f}ms  StdDev: {link.get('latency_stddev_ms', 0):.3f}ms")
        print(f"      Packet Loss: {link.get('packet_loss_rate', 0):.3f}%")

        pcts = link.get("latency_percentiles", {})
        if pcts:
            pct_str = "  ".join(f"{k}={v:.2f}ms" for k, v in pcts.items())
            print(f"      Percentiles: {pct_str}")
        print()

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="probe.py",
        description="Network Topology Profiler - Discover and analyze network topology with quality metrics",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python probe.py scan --subnet 192.168.1.0/24
  python probe.py scan --subnet 10.0.0.0/24 --output my_topology.json
  python probe.py view topology_192.168.1.0_24.json
  python probe.py analyze topology_192.168.1.0_24.json
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    scan_parser = subparsers.add_parser("scan", help="Scan a subnet and build topology")
    scan_parser.add_argument("--subnet", "-s", required=True, help="Subnet to scan (e.g., 192.168.1.0/24)")
    scan_parser.add_argument("--output", "-o", help="Output JSON file path")
    scan_parser.add_argument("--max-workers", type=int, default=30, help="Max concurrent threads (default: 30)")
    scan_parser.add_argument("--ping-count", type=int, default=3, help="Number of ping probes (default: 3)")
    scan_parser.add_argument("--timeout", type=int, default=2, help="Timeout per probe in seconds (default: 2)")
    scan_parser.add_argument("--max-hops", type=int, default=30, help="Max traceroute hops (default: 30)")

    view_parser = subparsers.add_parser("view", help="View a saved topology JSON file")
    view_parser.add_argument("file", help="Path to topology JSON file")

    analyze_parser = subparsers.add_parser("analyze", help="Detailed quality analysis of a topology file")
    analyze_parser.add_argument("file", help="Path to topology JSON file")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    if args.command == "scan":
        return cmd_scan(args)
    elif args.command == "view":
        return cmd_view(args)
    elif args.command == "analyze":
        return cmd_analyze(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
