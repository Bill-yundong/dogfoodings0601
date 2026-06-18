"""End-to-end integration tests for the cron health auditor."""

import os
import stat
import tempfile
import unittest
from datetime import datetime

from cron_audit import cmd_scan, cmd_report, build_parser, main
from database import Database
from log_analyzer import LogAnalyzer
from models import TaskEntry, TaskStatus
from scanner import CronScanner
from validator import CronValidator


SAMPLE_CRONTAB = """\
# /etc/crontab
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

0 2 * * * root /opt/backup/backup.sh --full
@hourly root /usr/local/bin/healthcheck.sh
*/15 * * * * root /opt/scripts/nonexistent.sh
0 0 1 * * root /opt/scripts/monthly_report.py && echo "done"
"""

SAMPLE_SYSLOG = """\
Jun 18 02:00:01 server CRON[11111]: (root) CMD (/opt/backup/backup.sh --full)
Jun 18 02:00:10 server CRON[11111]: (root) MAIL (mailed 100 bytes of output)
Jun 18 03:00:01 server CRON[11112]: (root) CMD (/usr/local/bin/healthcheck.sh)
Jun 18 03:00:02 server CRON[11112]: (root) CMD (/usr/local/bin/healthcheck.sh)
Jun 18 03:00:03 server CRON[11112]: (root) CMD (/usr/local/bin/healthcheck.sh)
Jun 18 03:15:01 server CRON[11113]: (root) CMD (/opt/scripts/nonexistent.sh)
Jun 18 03:15:01 server CRON[11113]: (root) MAIL (command not found)
Jun 18 06:00:01 server CRON[11114]: (root) CMD (/opt/scripts/monthly_report.py && echo "done")
"""


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

        # Create a valid executable script
        self.backup_script = os.path.join(self.tmpdir, "backup.sh")
        with open(self.backup_script, "w") as f:
            f.write("#!/bin/bash\necho backup\n")
        os.chmod(self.backup_script, 0o755)

        # Create a non-executable script
        self.report_script = os.path.join(self.tmpdir, "monthly_report.py")
        with open(self.report_script, "w") as f:
            f.write("#!/usr/bin/env python3\nprint('report')\n")
        os.chmod(self.report_script, 0o644)

        # Create a world-writable script
        self.ww_script = os.path.join(self.tmpdir, "ww.sh")
        with open(self.ww_script, "w") as f:
            f.write("#!/bin/bash\necho ww\n")
        os.chmod(self.ww_script, 0o777)

        # Generate a crontab referencing the temp-dir scripts
        crontab_content = (
            "# /etc/crontab\n"
            "SHELL=/bin/bash\n"
            f"0 2 * * * root {self.backup_script} --full\n"
            f"0 0 1 * * root {self.report_script} && echo done\n"
            f"0 6 * * * root {self.ww_script}\n"
            f"*/15 * * * * root /opt/scripts/nonexistent.sh\n"
        )
        self.crontab_path = os.path.join(self.tmpdir, "crontab")
        with open(self.crontab_path, "w") as f:
            f.write(crontab_content)

        # Generate a matching syslog
        syslog_content = (
            f"Jun 18 02:00:01 server CRON[11111]: (root) CMD ({self.backup_script} --full)\n"
            f"Jun 18 02:00:10 server CRON[11111]: (root) MAIL (mailed 100 bytes of output)\n"
            f"Jun 18 06:00:01 server CRON[11112]: (root) CMD ({self.ww_script})\n"
            f"Jun 18 06:00:02 server CRON[11112]: (root) CMD ({self.ww_script})\n"
            f"Jun 18 03:15:01 server CRON[11113]: (root) CMD (/opt/scripts/nonexistent.sh)\n"
            f"Jun 18 03:15:01 server CRON[11113]: (root) MAIL (command not found)\n"
        )
        self.syslog_path = os.path.join(self.tmpdir, "syslog")
        with open(self.syslog_path, "w") as f:
            f.write(syslog_content)

        # DB path
        self.db_path = os.path.join(self.tmpdir, "test.db")

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir)

    def test_full_scan_and_validate(self):
        """Scan → validate → analyze → persist flow."""
        scanner = CronScanner(
            sources=[self.crontab_path], include_user_crontab=False,
            force_system=True,
        )
        tasks = scanner.scan()
        self.assertEqual(len(tasks), 4)

        validator = CronValidator()
        validations = validator.validate_all(tasks)

        # Should have a mix of statuses: OK (backup.sh), ERROR (report.py
        # not executable, nonexistent.sh missing), WARNING (ww.sh world-writable)
        statuses = {v.status for v in validations}
        self.assertIn(TaskStatus.ERROR, statuses)

        analyzer = LogAnalyzer(log_paths=[self.syslog_path])
        records, stats = analyzer.analyze(tasks)
        self.assertTrue(len(records) > 0)
        self.assertTrue(len(stats) > 0)

        # Persist
        db = Database(self.db_path)
        scan_id = Database.new_scan_id()
        db.save_scan(scan_id, tasks, validations, records, stats)
        db.close()

        # Verify persistence
        db2 = Database(self.db_path)
        stored_vals = db2.get_validations(scan_id)
        self.assertEqual(len(stored_vals), 4)
        stored_stats = db2.get_task_stats(scan_id)
        self.assertTrue(len(stored_stats) > 0)
        db2.close()

    def test_cli_scan(self):
        """Test the scan CLI command with custom files."""
        parser = build_parser()
        args = parser.parse_args([
            "--db", self.db_path,
            "scan",
            "--crontab", self.crontab_path, "--system",
            "--log", self.syslog_path,
            "--no-user-crontab",
            "--days", "365",
        ])
        ret = cmd_scan(args)
        self.assertEqual(ret, 0)

        # Verify data was stored
        db = Database(self.db_path)
        scan_id = db.get_latest_scan_id()
        self.assertIsNotNone(scan_id)
        vals = db.get_validations(scan_id)
        self.assertEqual(len(vals), 4)
        db.close()

    def test_cli_report(self):
        """Test the report CLI command after a scan."""
        # First do a scan
        parser = build_parser()
        scan_args = parser.parse_args([
            "--db", self.db_path,
            "scan",
            "--crontab", self.crontab_path, "--system",
            "--log", self.syslog_path,
            "--no-user-crontab",
            "--days", "365",
        ])
        cmd_scan(scan_args)

        # Then get the report
        report_args = parser.parse_args([
            "--db", self.db_path,
            "report",
        ])
        ret = cmd_report(report_args)
        self.assertEqual(ret, 0)

    def test_cli_report_json(self):
        """Test JSON report output."""
        import io
        from contextlib import redirect_stdout

        parser = build_parser()
        scan_args = parser.parse_args([
            "--db", self.db_path,
            "scan",
            "--crontab", self.crontab_path, "--system",
            "--log", self.syslog_path,
            "--no-user-crontab",
            "--days", "365",
        ])
        cmd_scan(scan_args)

        buf = io.StringIO()
        with redirect_stdout(buf):
            report_args = parser.parse_args([
                "--db", self.db_path,
                "report", "--json",
            ])
            cmd_report(report_args)

        import json
        output = json.loads(buf.getvalue())
        self.assertIn("overall_health_score", output)
        self.assertIn("summary", output)
        self.assertIn("tasks", output)
        self.assertEqual(output["summary"]["total"], 4)

    def test_cli_no_data(self):
        """Test report when no scan has been run."""
        import io
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            parser = build_parser()
            args = parser.parse_args(["--db", self.db_path, "report"])
            ret = cmd_report(args)
        self.assertEqual(ret, 1)

    def test_cli_scan_json(self):
        """Test JSON scan output."""
        import io
        import json
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            parser = build_parser()
            args = parser.parse_args([
                "--db", self.db_path,
                "scan",
                "--crontab", self.crontab_path, "--system",
                "--log", self.syslog_path,
                "--no-user-crontab",
                "--days", "365",
                "--json",
            ])
            cmd_scan(args)

        output = json.loads(buf.getvalue())
        self.assertEqual(output["total_tasks"], 4)
        self.assertIn("scan_id", output)
        self.assertIn("tasks", output)
        self.assertIn("stats", output)

    def test_database_report_storage(self):
        """Test that reports are stored and retrievable."""
        parser = build_parser()
        scan_args = parser.parse_args([
            "--db", self.db_path,
            "scan",
            "--crontab", self.crontab_path, "--system",
            "--log", self.syslog_path,
            "--no-user-crontab",
            "--days", "365",
        ])
        cmd_scan(scan_args)

        db = Database(self.db_path)
        scan_id = db.get_latest_scan_id()
        report = db.get_report(scan_id)
        self.assertIsNotNone(report)
        self.assertEqual(report["total_tasks"], 4)
        self.assertGreater(report["overall_health_score"], 0)
        db.close()

    def test_history_command(self):
        """Test the history CLI command."""
        import io
        from contextlib import redirect_stdout

        parser = build_parser()
        for _ in range(2):
            cmd_scan(parser.parse_args([
                "--db", self.db_path,
                "scan",
                "--crontab", self.crontab_path, "--system",
                "--log", self.syslog_path,
                "--no-user-crontab",
                "--days", "365",
            ]))

        buf = io.StringIO()
        with redirect_stdout(buf):
            ret = cmd_report(parser.parse_args(["--db", self.db_path, "report"]))
        self.assertEqual(ret, 0)

        db = Database(self.db_path)
        scans = db.list_latest_scans()
        self.assertGreaterEqual(len(scans), 2)
        db.close()

    def test_main_function(self):
        """Test the main() entry point."""
        ret = main([
            "--db", self.db_path,
            "scan",
            "--crontab", self.crontab_path, "--system",
            "--log", self.syslog_path,
            "--no-user-crontab",
            "--days", "365",
        ])
        self.assertEqual(ret, 0)

    def test_main_no_args(self):
        """Test main() with no command shows help."""
        import io
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            ret = main(["--db", self.db_path])
        self.assertEqual(ret, 0)
        self.assertIn("usage", buf.getvalue().lower())


if __name__ == "__main__":
    unittest.main()
