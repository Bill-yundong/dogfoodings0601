"""Tests for validator.py – cron expression, script path and permission checks."""

import os
import stat
import tempfile
import unittest

from models import TaskEntry, TaskStatus
from validator import CronValidator


class TestCronExpressionValidation(unittest.TestCase):
    def setUp(self):
        self.validator = CronValidator()

    def _make_task(self, expr, command="/run.sh"):
        return TaskEntry(
            source="/etc/crontab",
            cron_expression=expr,
            command=command,
            minute=expr.split()[0] if not expr.startswith("@") and len(expr.split()) >= 1 else "",
            hour=expr.split()[1] if not expr.startswith("@") and len(expr.split()) >= 2 else "",
            day=expr.split()[2] if not expr.startswith("@") and len(expr.split()) >= 3 else "",
            month=expr.split()[3] if not expr.startswith("@") and len(expr.split()) >= 4 else "",
            weekday=expr.split()[4] if not expr.startswith("@") and len(expr.split()) >= 5 else "",
        )

    def test_valid_expression(self):
        result = self.validator.validate(self._make_task("0 2 * * *"))
        self.assertTrue(result.cron_expression_valid)
        self.assertEqual(result.cron_expression_errors, [])

    def test_valid_step(self):
        result = self.validator.validate(self._make_task("*/15 * * * *"))
        self.assertTrue(result.cron_expression_valid)

    def test_valid_range(self):
        result = self.validator.validate(self._make_task("0 9 * * 1-5"))
        self.assertTrue(result.cron_expression_valid)

    def test_valid_list(self):
        result = self.validator.validate(self._make_task("0,30 * * * *"))
        self.assertTrue(result.cron_expression_valid)

    def test_valid_range_step(self):
        result = self.validator.validate(self._make_task("0-30/5 * * * *"))
        self.assertTrue(result.cron_expression_valid)

    def test_valid_month_names(self):
        result = self.validator.validate(self._make_task("0 0 1 jan,jul *"))
        self.assertTrue(result.cron_expression_valid)

    def test_valid_weekday_names(self):
        result = self.validator.validate(self._make_task("0 0 * * mon,fri"))
        self.assertTrue(result.cron_expression_valid)

    def test_valid_at_macro(self):
        result = self.validator.validate(self._make_task("@daily"))
        self.assertTrue(result.cron_expression_valid)

    def test_invalid_minute_range(self):
        result = self.validator.validate(self._make_task("60 * * * *"))
        self.assertFalse(result.cron_expression_valid)
        self.assertTrue(any("out of range" in e for e in result.cron_expression_errors))

    def test_invalid_hour_range(self):
        result = self.validator.validate(self._make_task("* 25 * * *"))
        self.assertFalse(result.cron_expression_valid)

    def test_invalid_month(self):
        result = self.validator.validate(self._make_task("* * * 13 *"))
        self.assertFalse(result.cron_expression_valid)

    def test_too_few_fields(self):
        result = self.validator.validate(self._make_task("0 2"))
        self.assertFalse(result.cron_expression_valid)

    def test_invalid_value(self):
        result = self.validator.validate(self._make_task("abc * * * *"))
        self.assertFalse(result.cron_expression_valid)

    def test_weekday_7_is_valid(self):
        result = self.validator.validate(self._make_task("0 0 * * 7"))
        self.assertTrue(result.cron_expression_valid)

    def test_invalid_step(self):
        result = self.validator.validate(self._make_task("*/0 * * * *"))
        self.assertFalse(result.cron_expression_valid)

    def test_invalid_range_order(self):
        result = self.validator.validate(self._make_task("10-5 * * * *"))
        self.assertFalse(result.cron_expression_valid)


class TestScriptValidation(unittest.TestCase):
    def setUp(self):
        self.validator = CronValidator()
        self.tmpdir = tempfile.mkdtemp()
        self.executable = os.path.join(self.tmpdir, "run.sh")
        with open(self.executable, "w") as f:
            f.write("#!/bin/bash\necho hello\n")
        os.chmod(self.executable, 0o755)

        self.non_exec = os.path.join(self.tmpdir, "noexec.sh")
        with open(self.non_exec, "w") as f:
            f.write("#!/bin/bash\necho hello\n")
        os.chmod(self.non_exec, 0o644)

        self.world_writable = os.path.join(self.tmpdir, "ww.sh")
        with open(self.world_writable, "w") as f:
            f.write("#!/bin/bash\necho hello\n")
        os.chmod(self.world_writable, 0o777)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir)

    def _make_task(self, script_path):
        return TaskEntry(
            source="/etc/crontab",
            cron_expression="0 * * * *",
            command=script_path,
            script_path=script_path,
        )

    def test_executable_script_ok(self):
        result = self.validator.validate(self._make_task(self.executable))
        self.assertTrue(result.script_exists)
        self.assertTrue(result.is_executable)
        self.assertEqual(result.status, TaskStatus.OK)

    def test_missing_script_error(self):
        result = self.validator.validate(self._make_task("/nonexistent/script.sh"))
        self.assertFalse(result.script_exists)
        self.assertEqual(result.status, TaskStatus.ERROR)

    def test_non_executable_warning(self):
        result = self.validator.validate(self._make_task(self.non_exec))
        self.assertTrue(result.script_exists)
        self.assertFalse(result.is_executable)
        self.assertEqual(result.status, TaskStatus.ERROR)

    def test_world_writable_warning(self):
        result = self.validator.validate(self._make_task(self.world_writable))
        self.assertTrue(result.script_exists)
        self.assertTrue(result.is_executable)
        self.assertEqual(result.status, TaskStatus.WARNING)
        self.assertTrue(any("world-writable" in i for i in result.issues))

    def test_permission_octal(self):
        result = self.validator.validate(self._make_task(self.executable))
        self.assertEqual(result.permission_octal, "0o755")

    def test_no_script_path(self):
        task = TaskEntry(
            source="/etc/crontab",
            cron_expression="0 * * * *",
            command="echo hello",
            script_path=None,
        )
        result = self.validator.validate(task)
        self.assertTrue(any("No script path" in i for i in result.issues))


class TestStatusAggregation(unittest.TestCase):
    def setUp(self):
        self.validator = CronValidator()

    def test_error_status_for_bad_cron(self):
        task = TaskEntry(
            source="test", cron_expression="99 * * * *", command="/run.sh",
            script_path="/run.sh",
        )
        result = self.validator.validate(task)
        self.assertEqual(result.status, TaskStatus.ERROR)


if __name__ == "__main__":
    unittest.main()
