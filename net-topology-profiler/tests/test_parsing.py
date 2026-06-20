#!/usr/bin/env python3
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from topology.scanner import NetworkScanner
from topology.tracer import TracerouteProbe


def make_mock_subprocess_result(stdout: str, stderr: str = "", returncode: int = 0):
    mock = MagicMock()
    mock.stdout = stdout
    mock.stderr = stderr
    mock.returncode = returncode
    return mock


class TestPingParsingRobustness(unittest.TestCase):
    def setUp(self):
        self.scanner = NetworkScanner(max_workers=1, timeout=1, packets=3)
        self.scanner._system = "darwin"

    @patch("topology.scanner.subprocess.run")
    def test_ping_100_percent_loss_no_rtt_line(self, mock_run):
        output = (
            "PING 192.168.1.100 (192.168.1.100): 56 data bytes\n"
            "Request timeout for icmp_seq 0\n"
            "Request timeout for icmp_seq 1\n"
            "Request timeout for icmp_seq 2\n"
            "\n"
            "--- 192.168.1.100 ping statistics ---\n"
            "3 packets transmitted, 0 packets received, 100.0% packet loss\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.scanner.ping_host("192.168.1.100")

        self.assertIsNotNone(result)
        self.assertEqual(result.ip, "192.168.1.100")
        self.assertFalse(result.alive)
        self.assertEqual(result.packet_loss, 100.0)
        self.assertEqual(result.avg_rtt_ms, 0.0)
        self.assertEqual(result.min_rtt_ms, 0.0)
        self.assertEqual(result.max_rtt_ms, 0.0)
        self.assertEqual(result.packets_sent, 3)
        self.assertEqual(result.packets_received, 0)

    @patch("topology.scanner.subprocess.run")
    def test_ping_malformed_packet_loss_line(self, mock_run):
        output = (
            "PING 192.168.1.1 (192.168.1.1): 56 data bytes\n"
            "64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=1.234 ms\n"
            "\n"
            "--- 192.168.1.1 ping statistics ---\n"
            "3 packets transmitted, 3 packets received, CORRUPTED_DATA packet loss\n"
            "round-trip min/avg/max/stddev = 0.876/1.055/1.234/0.179 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.scanner.ping_host("192.168.1.1")

        self.assertIsNotNone(result)
        self.assertEqual(result.avg_rtt_ms, 1.055)
        self.assertEqual(result.min_rtt_ms, 0.876)
        self.assertEqual(result.max_rtt_ms, 1.234)
        self.assertIsInstance(result.packet_loss, float)

    @patch("topology.scanner.subprocess.run")
    def test_ping_no_route_to_host(self, mock_run):
        output = (
            "PING 192.168.200.1 (192.168.200.1): 56 data bytes\n"
            "ping: sendto: No route to host\n"
            "ping: sendto: No route to host\n"
            "\n"
            "--- 192.168.200.1 ping statistics ---\n"
            "3 packets transmitted, 0 packets received, 100.0% packet loss\n"
        )
        mock_run.return_value = make_mock_subprocess_result(
            stdout=output, stderr="ping: sendto: No route to host\n", returncode=1
        )

        result = self.scanner.ping_host("192.168.200.1")

        self.assertIsNotNone(result)
        self.assertFalse(result.alive)
        self.assertEqual(result.packet_loss, 100.0)
        self.assertEqual(result.avg_rtt_ms, 0.0)
        self.assertIsInstance(result.alive, bool)

    @patch("topology.scanner.subprocess.run")
    def test_ping_empty_output(self, mock_run):
        mock_run.return_value = make_mock_subprocess_result(stdout="", stderr="", returncode=1)

        result = self.scanner.ping_host("192.168.1.99")

        self.assertIsNotNone(result)
        self.assertFalse(result.alive)
        self.assertIsInstance(result.packet_loss, float)
        self.assertIsInstance(result.avg_rtt_ms, float)

    @patch("topology.scanner.subprocess.run")
    def test_ping_unknown_host(self, mock_run):
        output = "ping: cannot resolve nonexistent.host: Unknown host\n"
        mock_run.return_value = make_mock_subprocess_result(
            stdout="", stderr=output, returncode=68
        )

        result = self.scanner.ping_host("nonexistent.host")

        self.assertIsNotNone(result)
        self.assertFalse(result.alive)
        self.assertIsInstance(result.packet_loss, float)

    @patch("topology.scanner.subprocess.run")
    def test_ping_partial_loss_normal_rtt(self, mock_run):
        output = (
            "PING 192.168.1.50 (192.168.1.50): 56 data bytes\n"
            "64 bytes from 192.168.1.50: icmp_seq=0 ttl=64 time=5.678 ms\n"
            "Request timeout for icmp_seq 1\n"
            "64 bytes from 192.168.1.50: icmp_seq=2 ttl=64 time=4.321 ms\n"
            "\n"
            "--- 192.168.1.50 ping statistics ---\n"
            "3 packets transmitted, 2 packets received, 33.3% packet loss\n"
            "round-trip min/avg/max/stddev = 4.321/4.999/5.678/0.678 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.scanner.ping_host("192.168.1.50")

        self.assertIsNotNone(result)
        self.assertTrue(result.alive)
        self.assertEqual(result.packet_loss, 33.3)
        self.assertEqual(result.avg_rtt_ms, 4.999)
        self.assertEqual(result.min_rtt_ms, 4.321)
        self.assertEqual(result.max_rtt_ms, 5.678)
        self.assertGreater(result.avg_rtt_ms, 0)
        self.assertLess(result.packet_loss, 100)

    @patch("topology.scanner.subprocess.run")
    def test_ping_extremely_large_rtt_values(self, mock_run):
        output = (
            "PING 192.168.1.200 (192.168.1.200): 56 data bytes\n"
            "64 bytes from 192.168.1.200: icmp_seq=0 ttl=64 time=9999.99 ms\n"
            "64 bytes from 192.168.1.200: icmp_seq=1 ttl=64 time=8888.88 ms\n"
            "\n"
            "--- 192.168.1.200 ping statistics ---\n"
            "3 packets transmitted, 2 packets received, 33.3% packet loss\n"
            "round-trip min/avg/max/stddev = 8888.880/9444.435/9999.990/555.555 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.scanner.ping_host("192.168.1.200")

        self.assertIsNotNone(result)
        self.assertTrue(result.alive)
        self.assertEqual(result.avg_rtt_ms, 9444.435)
        self.assertEqual(result.min_rtt_ms, 8888.88)
        self.assertEqual(result.max_rtt_ms, 9999.99)
        self.assertGreater(result.avg_rtt_ms, 1000)
        self.assertIsInstance(result.avg_rtt_ms, float)

    @patch("topology.scanner.subprocess.run")
    def test_ping_unicode_and_junk_characters(self, mock_run):
        output = (
            "PING 192.168.1.1 (192.168.1.1): 56 data bytes\n"
            "64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=1.234 ms\n"
            "\n"
            "--- 192.168.1.1 ping statistics ---\n"
            "3 packets transmitted, 3 packets received, 0.0% packet loss\n"
            "round-trip min/avg/max/stddev = 0.999/1.111/1.234/0.117 ms\n"
            "\x00\x01\x02garbage\xff\xfe\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.scanner.ping_host("192.168.1.1")

        self.assertIsNotNone(result)
        self.assertTrue(result.alive)
        self.assertEqual(result.packet_loss, 0.0)
        self.assertEqual(result.avg_rtt_ms, 1.111)

    @patch("topology.scanner.subprocess.run")
    def test_ping_malformed_rtt_line(self, mock_run):
        output = (
            "PING 192.168.1.1 (192.168.1.1): 56 data bytes\n"
            "64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=1.234 ms\n"
            "\n"
            "--- 192.168.1.1 ping statistics ---\n"
            "3 packets transmitted, 3 packets received, 0.0% packet loss\n"
            "round-trip min/avg/max/stddev = NOT_A_NUMBER/1.111/INVALID/0.117 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.scanner.ping_host("192.168.1.1")

        self.assertIsNotNone(result)
        self.assertIsInstance(result.avg_rtt_ms, float)
        self.assertIsInstance(result.min_rtt_ms, float)
        self.assertIsInstance(result.max_rtt_ms, float)
        self.assertEqual(result.packet_loss, 0.0)

    @patch("topology.scanner.subprocess.run")
    def test_ping_does_not_raise_on_any_output(self, mock_run):
        weird_outputs = [
            "",
            "totally random garbage\nnot even ping output\n",
            "\x00\x01\x02\x03\x04",
            "round-trip NOT_A_NUMBER/1.0/2.0",
            "999999999999999999999999999999% packet loss",
            "--- statistics ---\n0 packets transmitted, 0 received, 100% loss\n",
            "PING: invalid option -- 'x'\n",
        ]

        for i, weird_output in enumerate(weird_outputs):
            with self.subTest(output_index=i):
                mock_run.return_value = make_mock_subprocess_result(stdout=weird_output)
                try:
                    result = self.scanner.ping_host("192.168.1.99")
                    self.assertIsNotNone(result)
                    self.assertIsInstance(result.alive, bool)
                    self.assertIsInstance(result.packet_loss, float)
                    self.assertIsInstance(result.avg_rtt_ms, float)
                except Exception as e:
                    self.fail(f"ping_host raised {type(e).__name__}: {e}")


class TestTracerouteParsingRobustness(unittest.TestCase):
    def setUp(self):
        self.tracer = TracerouteProbe(max_hops=10, probes_per_hop=3, timeout=1, max_workers=1)
        self.tracer._system = "darwin"

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_middle_hops_all_asterisks(self, mock_run):
        output = (
            "traceroute to 192.168.1.100 (192.168.1.100), 64 hops max, 52 byte packets\n"
            " 1  192.168.1.1  1.234 ms  0.987 ms  1.123 ms\n"
            " 2  * * *\n"
            " 3  * * *\n"
            " 4  * * *\n"
            " 5  192.168.1.100  10.999 ms  9.888 ms  10.111 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.100")

        self.assertIsNotNone(result)
        self.assertEqual(result.target, "192.168.1.100")
        self.assertTrue(result.success)
        self.assertTrue(result.destination_reached)
        self.assertEqual(len(result.hops), 5)

        self.assertEqual(result.hops[0].ip, "192.168.1.1")
        self.assertEqual(result.hops[0].packet_loss, 0.0)
        self.assertAlmostEqual(result.hops[0].avg_rtt_ms, 1.1147, places=1)

        self.assertEqual(result.hops[1].ip, "*")
        self.assertEqual(result.hops[1].packet_loss, 100.0)
        self.assertEqual(result.hops[1].avg_rtt_ms, 0.0)

        self.assertEqual(result.hops[2].ip, "*")
        self.assertEqual(result.hops[3].ip, "*")

        self.assertEqual(result.hops[4].ip, "192.168.1.100")
        self.assertEqual(result.hops[4].packet_loss, 0.0)
        self.assertGreater(result.hops[4].avg_rtt_ms, 0)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_extreme_large_rtt_values(self, mock_run):
        output = (
            "traceroute to 192.168.1.200 (192.168.1.200), 64 hops max, 52 byte packets\n"
            " 1  192.168.1.1  9999.99 ms  8888.88 ms  7777.77 ms\n"
            " 2  10.0.0.1  99999.99 ms  88888.88 ms  77777.77 ms\n"
            " 3  192.168.1.200  5.123 ms  4.321 ms  5.111 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.200")

        self.assertIsNotNone(result)
        self.assertTrue(result.success)
        self.assertEqual(len(result.hops), 3)

        hop1 = result.hops[0]
        self.assertEqual(hop1.ip, "192.168.1.1")
        self.assertGreater(hop1.avg_rtt_ms, 7000)
        self.assertAlmostEqual(hop1.avg_rtt_ms, (9999.99 + 8888.88 + 7777.77) / 3, places=1)
        self.assertGreater(hop1.jitter_ms, 0)

        hop2 = result.hops[1]
        self.assertEqual(hop2.ip, "10.0.0.1")
        self.assertGreater(hop2.avg_rtt_ms, 70000)
        self.assertIsInstance(hop2.avg_rtt_ms, float)

        hop3 = result.hops[2]
        self.assertLess(hop3.avg_rtt_ms, 10)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_no_route_to_host(self, mock_run):
        output = (
            "traceroute to 192.168.200.1 (192.168.200.1), 64 hops max, 52 byte packets\n"
            "traceroute: sendto: No route to host\n"
        )
        mock_run.return_value = make_mock_subprocess_result(
            stdout=output, stderr="traceroute: sendto: No route to host\n", returncode=1
        )

        result = self.tracer.trace("192.168.200.1")

        self.assertIsNotNone(result)
        self.assertFalse(result.success)
        self.assertFalse(result.destination_reached)
        self.assertEqual(len(result.hops), 0)
        self.assertIsInstance(result.success, bool)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_all_asterisks(self, mock_run):
        output = (
            "traceroute to 192.168.1.254 (192.168.1.254), 64 hops max, 52 byte packets\n"
            " 1  * * *\n"
            " 2  * * *\n"
            " 3  * * *\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.254")

        self.assertIsNotNone(result)
        self.assertFalse(result.success)
        self.assertEqual(len(result.hops), 3)
        for hop in result.hops:
            self.assertEqual(hop.ip, "*")
            self.assertEqual(hop.packet_loss, 100.0)
            self.assertEqual(hop.avg_rtt_ms, 0.0)
            self.assertIsInstance(hop.packet_loss, float)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_partial_mixed_asterisks_and_rtt(self, mock_run):
        output = (
            "traceroute to 192.168.1.50 (192.168.1.50), 64 hops max, 52 byte packets\n"
            " 1  192.168.1.1  1.234 ms  *  1.123 ms\n"
            " 2  10.0.0.1  *  5.678 ms  *\n"
            " 3  192.168.1.50  10.111 ms  9.999 ms  10.222 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.50")

        self.assertIsNotNone(result)
        self.assertTrue(result.success)
        self.assertEqual(len(result.hops), 3)

        hop1 = result.hops[0]
        self.assertEqual(hop1.ip, "192.168.1.1")
        self.assertEqual(len(hop1.rtt_ms), 2)
        self.assertGreater(hop1.packet_loss, 0)
        self.assertLess(hop1.packet_loss, 100)

        hop2 = result.hops[1]
        self.assertEqual(hop2.ip, "10.0.0.1")
        self.assertEqual(len(hop2.rtt_ms), 1)
        self.assertAlmostEqual(hop2.packet_loss, 66.666, places=1)

        hop3 = result.hops[2]
        self.assertEqual(len(hop3.rtt_ms), 3)
        self.assertEqual(hop3.packet_loss, 0.0)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_empty_output(self, mock_run):
        mock_run.return_value = make_mock_subprocess_result(stdout="", stderr="", returncode=1)

        result = self.tracer.trace("192.168.1.99")

        self.assertIsNotNone(result)
        self.assertFalse(result.success)
        self.assertEqual(len(result.hops), 0)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_malformed_hop_numbers(self, mock_run):
        output = (
            "traceroute to 192.168.1.10 (192.168.1.10), 64 hops max, 52 byte packets\n"
            " 1  192.168.1.1  1.234 ms  0.987 ms  1.123 ms\n"
            "NOT_A_NUMBER  10.0.0.1  5.678 ms  4.321 ms  5.111 ms\n"
            " 3  192.168.1.10  10.111 ms  9.999 ms  10.222 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.10")

        self.assertIsNotNone(result)
        self.assertEqual(len(result.hops), 2)
        self.assertEqual(result.hops[0].hop, 1)
        self.assertEqual(result.hops[1].hop, 3)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_negative_rtt_values(self, mock_run):
        output = (
            "traceroute to 192.168.1.10 (192.168.1.10), 64 hops max, 52 byte packets\n"
            " 1  192.168.1.1  1.234 ms  -0.500 ms  1.123 ms\n"
            " 2  192.168.1.10  5.678 ms  4.321 ms  5.111 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.10")

        self.assertIsNotNone(result)
        self.assertEqual(len(result.hops), 2)
        hop1 = result.hops[0]
        self.assertIsInstance(hop1.avg_rtt_ms, float)
        self.assertEqual(len(hop1.rtt_ms), 3)
        self.assertIn(-0.500, hop1.rtt_ms)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_malformed_rtt_values(self, mock_run):
        output = (
            "traceroute to 192.168.1.10 (192.168.1.10), 64 hops max, 52 byte packets\n"
            " 1  192.168.1.1  INVALID ms  BAD_DATA ms  1.123 ms\n"
            " 2  192.168.1.10  5.678 ms  4.321 ms  5.111 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.10")

        self.assertIsNotNone(result)
        self.assertEqual(len(result.hops), 2)
        hop1 = result.hops[0]
        self.assertEqual(len(hop1.rtt_ms), 1)
        self.assertEqual(hop1.avg_rtt_ms, 1.123)
        self.assertIsInstance(hop1.packet_loss, float)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_hostname_output(self, mock_run):
        output = (
            "traceroute to 192.168.1.10 (192.168.1.10), 64 hops max, 52 byte packets\n"
            " 1  router.local (192.168.1.1)  1.234 ms  0.987 ms  1.123 ms\n"
            " 2  192.168.1.10 (192.168.1.10)  10.111 ms  9.999 ms  10.222 ms\n"
        )
        mock_run.return_value = make_mock_subprocess_result(stdout=output)

        result = self.tracer.trace("192.168.1.10")

        self.assertIsNotNone(result)
        self.assertTrue(result.success)
        self.assertEqual(len(result.hops), 2)
        self.assertEqual(result.hops[0].ip, "192.168.1.1")
        self.assertEqual(result.hops[1].ip, "192.168.1.10")
        self.assertIsInstance(result.hops[0].avg_rtt_ms, float)

    @patch("topology.tracer.subprocess.run")
    def test_traceroute_does_not_raise_on_any_output(self, mock_run):
        weird_outputs = [
            "",
            "total garbage traceroute\nnot even real output\n",
            "\x00\x01\x02 garbage",
            " 1  *  *  *  *  *  *\n",
            "traceroute to nowhere: 30 hops max\n  NOT_A_HOP  1.2.3.4  100 ms\n",
        ]

        for i, weird_output in enumerate(weird_outputs):
            with self.subTest(output_index=i):
                mock_run.return_value = make_mock_subprocess_result(stdout=weird_output)
                try:
                    result = self.tracer.trace("192.168.1.99")
                    self.assertIsNotNone(result)
                    self.assertIsInstance(result.success, bool)
                    self.assertIsInstance(result.hops, list)
                except Exception as e:
                    self.fail(f"trace raised {type(e).__name__}: {e}")


if __name__ == "__main__":
    unittest.main()
