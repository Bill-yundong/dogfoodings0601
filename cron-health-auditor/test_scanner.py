"""Tests for scanner.py – crontab file parsing and script-path extraction."""

import os
import tempfile
import unittest

from scanner import CronScanner, extract_script_path
from models import TaskEntry


SYSTEM_CRONTAB = """\
# /etc/crontab - system-wide crontab
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root

# Daily backup at 2am
0 2 * * * root /opt/backup/backup.sh --full
# Hourly health check
@hourly root /usr/local/bin/healthcheck.sh
# Monthly report with shell operator
0 0 1 * * root /opt/scripts/monthly_report.py && echo "done"
# Env var prefix
*/30 * * * * root FOO=bar BAZ=qux /opt/scripts/run.sh --flag
"""

USER_CRONTAB = """\
SHELL=/bin/sh
# Every 15 minutes
*/15 * * * * /home/user/scripts/sync.sh
# Weekday morning with comment
0 9 * * 1-5 /home/user/scripts/morning.sh # morning routine
# Using @daily
@daily /home/user/scripts/cleanup.sh
"""


class TestSystemCrontabParsing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix="_crontab", delete=False
        )
        self.tmp.write(SYSTEM_CRONTAB)
        self.tmp.close()

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_scans_system_crontab(self):
        scanner = CronScanner(sources=[self.tmp.name], include_user_crontab=False, force_system=True)
        tasks = scanner.scan()
        # 4 task entries (MAILTO/SHELL/PATH are env vars)
        self.assertEqual(len(tasks), 4)

    def test_extracts_user_field(self):
        scanner = CronScanner(sources=[self.tmp.name], include_user_crontab=False, force_system=True)
        tasks = scanner.scan()
        for t in tasks:
            self.assertEqual(t.user, "root")

    def test_parses_cron_fields(self):
        scanner = CronScanner(sources=[self.tmp.name], include_user_crontab=False, force_system=True)
        tasks = scanner.scan()
        backup = next(t for t in tasks if "backup.sh" in t.command)
        self.assertEqual(backup.minute, "0")
        self.assertEqual(backup.hour, "2")
        self.assertEqual(backup.cron_expression, "0 2 * * *")

    def test_handles_at_macros(self):
        scanner = CronScanner(sources=[self.tmp.name], include_user_crontab=False, force_system=True)
        tasks = scanner.scan()
        hourly = next(t for t in tasks if "healthcheck" in t.command)
        self.assertEqual(hourly.cron_expression, "0 * * * *")

    def test_env_vars_not_tasks(self):
        scanner = CronScanner(sources=[self.tmp.name], include_user_crontab=False, force_system=True)
        tasks = scanner.scan()
        commands = [t.command for t in tasks]
        self.assertFalse(any("SHELL=" in c for c in commands))
        self.assertFalse(any("PATH=" in c for c in commands))
        self.assertFalse(any("MAILTO=" in c for c in commands))


class TestUserCrontabParsing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix="_crontab", delete=False
        )
        self.tmp.write(USER_CRONTAB)
        self.tmp.close()

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_user_has_no_user_field(self):
        scanner = CronScanner(
            sources=[self.tmp.name],
            include_user_crontab=False,
        )
        tasks = scanner.scan()
        self.assertEqual(len(tasks), 3)
        for t in tasks:
            self.assertIsNone(t.user)

    def test_at_daily_macro(self):
        scanner = CronScanner(sources=[self.tmp.name], include_user_crontab=False)
        tasks = scanner.scan()
        daily = next(t for t in tasks if "cleanup" in t.command)
        self.assertEqual(daily.cron_expression, "0 0 * * *")


class TestExtractScriptPath(unittest.TestCase):
    def test_simple_path(self):
        self.assertEqual(
            extract_script_path("/opt/backup/backup.sh --full"),
            "/opt/backup/backup.sh",
        )

    def test_shell_operator(self):
        self.assertEqual(
            extract_script_path('/opt/scripts/report.py && echo "done"'),
            "/opt/scripts/report.py",
        )

    def test_env_var_prefix(self):
        self.assertEqual(
            extract_script_path("FOO=bar BAZ=qux /opt/scripts/run.sh --flag"),
            "/opt/scripts/run.sh",
        )

    def test_relative_path(self):
        self.assertEqual(
            extract_script_path("./scripts/sync.sh"),
            "scripts/sync.sh",
        )

    def test_command_in_path(self):
        path = extract_script_path("echo hello")
        self.assertIsNotNone(path)
        self.assertTrue("echo" in path)

    def test_empty_command(self):
        self.assertIsNone(extract_script_path(""))


class TestMissingFiles(unittest.TestCase):
    def test_nonexistent_file(self):
        scanner = CronScanner(
            sources=["/nonexistent/crontab"], include_user_crontab=False
        )
        self.assertEqual(scanner.scan(), [])

    def test_empty_content(self):
        scanner = CronScanner(sources=[], include_user_crontab=False)
        tasks = scanner._parse_content("", source="empty", is_system=True)
        self.assertEqual(tasks, [])


class TestFingerprint(unittest.TestCase):
    def test_fingerprint_stable(self):
        t1 = TaskEntry(source="a", cron_expression="0 * * * *", command="/run.sh")
        t2 = TaskEntry(source="b", cron_expression="0 * * * *", command="/run.sh")
        self.assertEqual(t1.fingerprint(), t2.fingerprint())

    def test_fingerprint_differs(self):
        t1 = TaskEntry(source="a", cron_expression="0 * * * *", command="/run.sh")
        t2 = TaskEntry(source="a", cron_expression="1 * * * *", command="/run.sh")
        self.assertNotEqual(t1.fingerprint(), t2.fingerprint())


if __name__ == "__main__":
    unittest.main()
