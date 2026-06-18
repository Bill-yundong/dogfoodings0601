"""Tests for log_analyzer.py – syslog parsing, matching and statistics."""

import os
import tempfile
import unittest
from datetime import datetime

from log_analyzer import LogAnalyzer, _normalise
from models import ExecutionRecord, TaskEntry


SAMPLE_SYSLOG = """\
Jun 18 02:00:01 server CRON[12345]: (root) CMD (/opt/backup/backup.sh --full)
Jun 18 02:00:08 server CRON[12345]: (root) MAIL (mailed 100 bytes of output but got status 0x004b)
Jun 18 03:00:01 server CRON[12346]: (root) CMD (/usr/local/bin/healthcheck.sh)
Jun 18 03:00:02 server CRON[12346]: (root) CMD (/usr/local/bin/healthcheck.sh)
Jun 18 04:00:01 server CRON[12347]: (root) CMD (/opt/scripts/nonexistent.sh)
Jun 18 04:00:01 server CRON[12347]: (root) MAIL (command not found)
Jun 18 05:00:01 server CRON[12348]: (appuser) CMD (/opt/app/sync.sh)
Jun 18 05:00:03 server CRON[12348]: (appuser) CMD (/opt/app/sync.sh)
Jun 18 06:00:01 server CRON[12349]: (root) CMD (/opt/scripts/report.py && echo done)
Jun 18 06:00:05 server CRON[12349]: (root) MAIL (mailed 50 bytes)
"""


class TestSyslogParsing(unittest.TestCase):
    def setUp(self):
        self.analyzer = LogAnalyzer(log_paths=[])

    def test_parse_cmd_lines(self):
        records = self.analyzer.parse_content(SAMPLE_SYSLOG)
        self.assertEqual(len(records), 7)

    def test_extract_user(self):
        records = self.analyzer.parse_content(SAMPLE_SYSLOG)
        users = {r.user for r in records}
        self.assertIn("root", users)
        self.assertIn("appuser", users)

    def test_extract_command(self):
        records = self.analyzer.parse_content(SAMPLE_SYSLOG)
        cmds = [r.command for r in records]
        self.assertTrue(any("backup.sh --full" in c for c in cmds))
        self.assertTrue(any("healthcheck.sh" in c for c in cmds))

    def test_pid_extraction(self):
        records = self.analyzer.parse_content(SAMPLE_SYSLOG)
        pids = {r.pid for r in records}
        self.assertIn(12345, pids)
        self.assertIn(12346, pids)

    def test_failure_correlation_by_pid(self):
        records = self.analyzer.parse_content(SAMPLE_SYSLOG)
        # PID 12345 had a MAIL failure
        backup_records = [r for r in records if r.pid == 12345]
        self.assertTrue(any(not r.success for r in backup_records))

    def test_success_for_clean_runs(self):
        records = self.analyzer.parse_content(SAMPLE_SYSLOG)
        healthcheck = [r for r in records if "healthcheck" in r.command]
        self.assertTrue(all(r.success for r in healthcheck))


class TestTimestampParsing(unittest.TestCase):
    def test_parse_standard_ts(self):
        ts = LogAnalyzer._parse_timestamp("Jun 18 10:00:01")
        self.assertIsNotNone(ts)
        self.assertEqual(ts.month, 6)
        self.assertEqual(ts.day, 18)

    def test_year_inference_future(self):
        ts = LogAnalyzer._parse_timestamp("Dec 31 23:59:59")
        now = datetime.now()
        if ts > now:
            self.assertEqual(ts.year, now.year - 1)

    def test_invalid_ts(self):
        self.assertIsNone(LogAnalyzer._parse_timestamp("invalid"))


class TestCommandMatching(unittest.TestCase):
    def setUp(self):
        self.tasks = [
            TaskEntry(
                source="/etc/crontab",
                cron_expression="0 2 * * *",
                command="/opt/backup/backup.sh --full",
                script_path="/opt/backup/backup.sh",
            ),
            TaskEntry(
                source="/etc/crontab",
                cron_expression="@hourly",
                command="/usr/local/bin/healthcheck.sh",
                script_path="/usr/local/bin/healthcheck.sh",
            ),
        ]

    def test_exact_match(self):
        analyzer = LogAnalyzer(log_paths=[])
        records = analyzer.parse_content(SAMPLE_SYSLOG)
        matched = analyzer.match_records(records, self.tasks)
        self.assertTrue(len(matched) > 0)

    def test_substring_match(self):
        analyzer = LogAnalyzer(log_paths=[])
        record = ExecutionRecord(
            timestamp=datetime.now(),
            user="root",
            command="/opt/backup/backup.sh --full",
            pid=1,
            success=True,
        )
        matched = analyzer.match_records([record], self.tasks)
        self.assertEqual(len(matched), 1)


class TestStatisticsComputation(unittest.TestCase):
    def setUp(self):
        self.tasks = [
            TaskEntry(
                source="/etc/crontab",
                cron_expression="0 2 * * *",
                command="/opt/backup/backup.sh --full",
                script_path="/opt/backup/backup.sh",
            ),
            TaskEntry(
                source="/etc/crontab",
                cron_expression="@hourly",
                command="/usr/local/bin/healthcheck.sh",
                script_path="/usr/local/bin/healthcheck.sh",
            ),
        ]

    def test_stats_computed(self):
        analyzer = LogAnalyzer(log_paths=[])
        records = analyzer.parse_content(SAMPLE_SYSLOG)
        stats = LogAnalyzer.compute_stats(records, self.tasks)
        self.assertTrue(len(stats) > 0)

    def test_success_rate(self):
        analyzer = LogAnalyzer(log_paths=[])
        records = analyzer.parse_content(SAMPLE_SYSLOG)
        stats = LogAnalyzer.compute_stats(records, self.tasks)
        for s in stats:
            self.assertIsNotNone(s.success_rate)
            self.assertEqual(s.total_runs, s.success_count + s.failure_count)

    def test_backup_has_failures(self):
        analyzer = LogAnalyzer(log_paths=[])
        records = analyzer.parse_content(SAMPLE_SYSLOG)
        stats = LogAnalyzer.compute_stats(records, self.tasks)
        backup_fp = self.tasks[0].fingerprint()
        backup_stat = next(s for s in stats if s.fingerprint == backup_fp)
        self.assertGreater(backup_stat.failure_count, 0)
        self.assertLess(backup_stat.success_rate, 1.0)

    def test_last_run(self):
        analyzer = LogAnalyzer(log_paths=[])
        records = analyzer.parse_content(SAMPLE_SYSLOG)
        stats = LogAnalyzer.compute_stats(records, self.tasks)
        for s in stats:
            self.assertIsNotNone(s.last_run)


class TestNormalise(unittest.TestCase):
    def test_strips_whitespace(self):
        self.assertEqual(_normalise("  hello  world  "), "hello world")

    def test_lowercase(self):
        self.assertEqual(_normalise("Hello WORLD"), "hello world")


class TestFileBasedParsing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix="_syslog", delete=False
        )
        self.tmp.write(SAMPLE_SYSLOG)
        self.tmp.close()

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_parse_from_file(self):
        analyzer = LogAnalyzer(log_paths=[self.tmp.name])
        records = analyzer.parse_logs()
        self.assertTrue(len(records) > 0)

    def test_since_filter(self):
        analyzer = LogAnalyzer(log_paths=[self.tmp.name])
        all_records = analyzer.parse_logs()
        since = datetime(datetime.now().year, 6, 18, 4, 0)
        filtered = analyzer.parse_logs(since=since)
        self.assertLess(len(filtered), len(all_records))


if __name__ == "__main__":
    unittest.main()
