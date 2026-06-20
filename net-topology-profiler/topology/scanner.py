import subprocess
import ipaddress
import platform
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class HostInfo:
    ip: str
    hostname: str = ""
    alive: bool = False
    avg_rtt_ms: float = 0.0
    min_rtt_ms: float = 0.0
    max_rtt_ms: float = 0.0
    packet_loss: float = 0.0
    packets_sent: int = 0
    packets_received: int = 0


class NetworkScanner:
    def __init__(self, max_workers: int = 50, timeout: int = 2, packets: int = 3):
        self.max_workers = max_workers
        self.timeout = timeout
        self.packets = packets
        self._system = platform.system().lower()

    def _ping_command(self, target: str) -> List[str]:
        if self._system == "windows":
            return ["ping", "-n", str(self.packets), "-w", str(self.timeout * 1000), target]
        else:
            return ["ping", "-c", str(self.packets), "-W", str(self.timeout), target]

    def _parse_ping_output(self, output: str, target: str) -> HostInfo:
        host = HostInfo(ip=target)
        host.packets_sent = self.packets

        lines = output.strip().split("\n")

        for line in lines:
            line_lower = line.lower()
            if "packet loss" in line_lower or "丢失" in line_lower:
                if self._system == "windows":
                    parts = line.replace("(", "").replace(")", "").replace("%", "").split()
                    for i, part in enumerate(parts):
                        if "loss" in part.lower() or "丢失" in part:
                            if i > 0:
                                try:
                                    host.packet_loss = float(parts[i - 1].replace("%", ""))
                                except ValueError:
                                    pass
                            break
                else:
                    import re
                    match = re.search(r"(\d+(?:\.\d+)?)% packet loss", line_lower)
                    if match:
                        host.packet_loss = float(match.group(1))

            if "rtt min/avg/max" in line_lower or "min/avg/max" in line_lower:
                import re
                match = re.search(r"(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)", line)
                if match:
                    host.min_rtt_ms = float(match.group(1))
                    host.avg_rtt_ms = float(match.group(2))
                    host.max_rtt_ms = float(match.group(3))

        if self._system == "windows":
            for line in lines:
                if "Average" in line or "平均" in line:
                    import re
                    match = re.search(r"[=<] (\d+(?:\.\d+)?)ms", line)
                    if match:
                        host.avg_rtt_ms = float(match.group(1))
                    match_min = re.search(r"Minimum.*?[=<] (\d+(?:\.\d+)?)ms", line_lower)
                    if match_min:
                        host.min_rtt_ms = float(match_min.group(1))
                    match_max = re.search(r"Maximum.*?[=<] (\d+(?:\.\d+)?)ms", line_lower)
                    if match_max:
                        host.max_rtt_ms = float(match_max.group(1))

        host.packets_received = int(host.packets_sent * (1 - host.packet_loss / 100))
        host.alive = host.packet_loss < 100 and host.avg_rtt_ms > 0

        return host

    def ping_host(self, target: str) -> HostInfo:
        try:
            cmd = self._ping_command(target)
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout * self.packets + 5,
            )
            host = self._parse_ping_output(result.stdout + result.stderr, target)
            if not host.alive and result.returncode != 0:
                host.alive = False
                host.packet_loss = 100.0
            return host
        except subprocess.TimeoutExpired:
            host = HostInfo(ip=target, alive=False, packet_loss=100.0, packets_sent=self.packets)
            return host
        except Exception:
            host = HostInfo(ip=target, alive=False, packet_loss=100.0, packets_sent=self.packets)
            return host

    def scan_subnet(self, subnet: str) -> List[HostInfo]:
        network = ipaddress.ip_network(subnet, strict=False)
        hosts = [str(ip) for ip in network.hosts()]

        results: List[HostInfo] = []
        alive_hosts: List[HostInfo] = []

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_ip = {executor.submit(self.ping_host, ip): ip for ip in hosts}
            for future in as_completed(future_to_ip):
                try:
                    host_info = future.result()
                    results.append(host_info)
                    if host_info.alive:
                        alive_hosts.append(host_info)
                except Exception:
                    pass

        alive_hosts.sort(key=lambda h: ipaddress.ip_address(h.ip))
        return alive_hosts

    def scan_hosts(self, targets: List[str]) -> List[HostInfo]:
        results: List[HostInfo] = []

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_ip = {executor.submit(self.ping_host, ip): ip for ip in targets}
            for future in as_completed(future_to_ip):
                try:
                    host_info = future.result()
                    results.append(host_info)
                except Exception:
                    pass

        results.sort(key=lambda h: h.ip)
        return results
