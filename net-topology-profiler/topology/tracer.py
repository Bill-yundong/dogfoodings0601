import subprocess
import platform
import re
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed


@dataclass
class HopInfo:
    hop: int
    ip: str
    hostname: str = ""
    rtt_ms: List[float] = field(default_factory=list)
    avg_rtt_ms: float = 0.0
    min_rtt_ms: float = 0.0
    max_rtt_ms: float = 0.0
    jitter_ms: float = 0.0
    packet_loss: float = 0.0
    probes_sent: int = 0
    probes_received: int = 0


@dataclass
class TracerouteResult:
    target: str
    hops: List[HopInfo] = field(default_factory=list)
    success: bool = False
    total_hops: int = 0
    destination_reached: bool = False


class TracerouteProbe:
    def __init__(self, max_hops: int = 30, probes_per_hop: int = 3, timeout: int = 2, max_workers: int = 10):
        self.max_hops = max_hops
        self.probes_per_hop = probes_per_hop
        self.timeout = timeout
        self.max_workers = max_workers
        self._system = platform.system().lower()

    def _traceroute_command(self, target: str) -> List[str]:
        if self._system == "windows":
            return [
                "tracert",
                "-h", str(self.max_hops),
                "-w", str(self.timeout * 1000),
                "-d",
                target,
            ]
        else:
            return [
                "traceroute",
                "-m", str(self.max_hops),
                "-q", str(self.probes_per_hop),
                "-w", str(self.timeout),
                "-n",
                target,
            ]

    def _parse_traceroute_output(self, output: str, target: str) -> TracerouteResult:
        result = TracerouteResult(target=target)
        lines = output.strip().split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            hop_match = re.match(r"^\s*(\d+)\s+", line)
            if not hop_match:
                continue

            hop_num = int(hop_match.group(1))

            rtt_values = []
            ip = ""
            lost_count = 0

            asterisks = line.count("*")
            lost_count = asterisks

            ip_pattern = r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
            ip_matches = re.findall(ip_pattern, line)
            if ip_matches:
                ip = ip_matches[0]

            rtt_pattern = r"(\d+(?:\.\d+)?)\s*ms"
            rtt_matches = re.findall(rtt_pattern, line)
            rtt_values = [float(r) for r in rtt_matches]

            probes_received = len(rtt_values)
            probes_sent = self.probes_per_hop if self._system != "windows" else max(3, asterisks + len(rtt_values))
            packet_loss = (probes_sent - probes_received) / probes_sent * 100 if probes_sent > 0 else 100.0

            avg_rtt = sum(rtt_values) / len(rtt_values) if rtt_values else 0.0
            min_rtt = min(rtt_values) if rtt_values else 0.0
            max_rtt = max(rtt_values) if rtt_values else 0.0

            if len(rtt_values) >= 2:
                jitter = max_rtt - min_rtt
            else:
                jitter = 0.0

            hop_info = HopInfo(
                hop=hop_num,
                ip=ip if ip else "*",
                rtt_ms=rtt_values,
                avg_rtt_ms=avg_rtt,
                min_rtt_ms=min_rtt,
                max_rtt_ms=max_rtt,
                jitter_ms=jitter,
                packet_loss=packet_loss,
                probes_sent=probes_sent,
                probes_received=probes_received,
            )

            result.hops.append(hop_info)

            if ip == target and rtt_values:
                result.destination_reached = True

        result.total_hops = len(result.hops)
        result.success = result.destination_reached and len(result.hops) > 0

        return result

    def trace(self, target: str) -> TracerouteResult:
        try:
            cmd = self._traceroute_command(target)
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.max_hops * self.timeout * self.probes_per_hop + 10,
            )
            trace_result = self._parse_traceroute_output(result.stdout + result.stderr, target)
            if not trace_result.success and result.returncode != 0:
                trace_result.success = False
            return trace_result
        except subprocess.TimeoutExpired:
            return TracerouteResult(target=target, success=False)
        except Exception:
            return TracerouteResult(target=target, success=False)

    def trace_multiple(self, targets: List[str]) -> Dict[str, TracerouteResult]:
        results: Dict[str, TracerouteResult] = {}

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_target = {executor.submit(self.trace, t): t for t in targets}
            for future in as_completed(future_to_target):
                target = future_to_target[future]
                try:
                    result = future.result()
                    results[target] = result
                except Exception as e:
                    results[target] = TracerouteResult(target=target, success=False)

        return results
