"""Task validator for the cron health auditor.

Checks three aspects of every :class:`TaskEntry`:

1. **Cron expression validity** – each of the five fields (minute, hour,
   day-of-month, month, day-of-week) is parsed independently and checked
   against its legal value range, including ``@``-style macros.
2. **Script path existence** – the path extracted by the scanner is
   checked with :func:`os.path.exists`.
3. **Executable permission** – the file's permission bits are inspected
   to ensure the owner / group / others execute bit is set.

The results are aggregated into a :class:`ValidationResult` with an
overall :class:`TaskStatus`.
"""

from __future__ import annotations

import os
import stat
from typing import List

from models import TaskEntry, TaskStatus, ValidationResult

# Value ranges for each cron field.
FIELD_RANGES = {
    "minute": (0, 59),
    "hour": (0, 23),
    "day": (1, 31),
    "month": (1, 12),
    "weekday": (0, 7),
}

_MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_WEEKDAY_NAMES = {
    "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4,
    "fri": 5, "sat": 6,
}

_FIELD_ORDER = ["minute", "hour", "day", "month", "weekday"]


class CronValidator:
    """Validate cron expressions, script paths and permissions."""

    def validate(self, task: TaskEntry) -> ValidationResult:
        result = ValidationResult(task=task)
        self._validate_cron_expression(task, result)
        self._validate_script(task, result)
        result.status = self._compute_status(result)
        return result

    def validate_all(self, tasks: List[TaskEntry]) -> List[ValidationResult]:
        return [self.validate(t) for t in tasks]

    # ------------------------------------------------------------------ #
    # cron expression validation
    # ------------------------------------------------------------------ #
    def _validate_cron_expression(
        self, task: TaskEntry, result: ValidationResult
    ) -> None:
        expr = task.cron_expression.strip()

        if expr.startswith("@"):
            if expr.lower() not in {
                "@reboot", "@yearly", "@annually", "@monthly",
                "@weekly", "@daily", "@midnight", "@hourly",
            }:
                result.cron_expression_valid = False
                result.cron_expression_errors.append(
                    f"Unknown @-style macro: {expr}"
                )
            return

        fields = expr.split()
        if len(fields) != 5:
            result.cron_expression_valid = False
            result.cron_expression_errors.append(
                f"Expected 5 fields, got {len(fields)}: '{expr}'"
            )
            return

        for name, value in zip(_FIELD_ORDER, fields):
            errors = self._validate_field(name, value)
            if errors:
                result.cron_expression_valid = False
                result.cron_expression_errors.extend(errors)

    @staticmethod
    def _validate_field(field_name: str, value: str) -> List[str]:
        """Validate a single cron field, returning a list of error strings."""
        lo, hi = FIELD_RANGES[field_name]
        errors: List[str] = []

        # Split on comma to handle lists: 1,3,5
        for item in value.split(","):
            item = item.strip()
            if not item:
                errors.append(f"{field_name}: empty list element in '{value}'")
                continue

            # Handle step: */2, 1-5/2, 5/2
            step = 1
            base = item
            if "/" in item:
                parts = item.split("/", 1)
                if len(parts) != 2 or not parts[1]:
                    errors.append(f"{field_name}: invalid step in '{item}'")
                    continue
                base, step_str = parts
                try:
                    step = int(step_str)
                    if step <= 0:
                        errors.append(f"{field_name}: step must be > 0 in '{item}'")
                        continue
                except ValueError:
                    errors.append(f"{field_name}: non-numeric step '{step_str}'")
                    continue

            # Parse the base part
            if base == "*":
                continue
            elif "-" in base:
                parts = base.split("-", 1)
                if len(parts) != 2:
                    errors.append(f"{field_name}: invalid range '{base}'")
                    continue
                start, end = parts
                start_val = CronValidator._parse_value(field_name, start, errors)
                end_val = CronValidator._parse_value(field_name, end, errors)
                if start_val is not None and end_val is not None:
                    if start_val > end_val and not (
                        field_name == "weekday" and start_val == 7
                    ):
                        errors.append(
                            f"{field_name}: range start {start_val} > end {end_val} "
                            f"in '{item}'"
                        )
                    if start_val < lo or start_val > hi:
                        errors.append(
                            f"{field_name}: value {start_val} out of range "
                            f"[{lo},{hi}]"
                        )
                    if end_val < lo or end_val > hi:
                        errors.append(
                            f"{field_name}: value {end_val} out of range "
                            f"[{lo},{hi}]"
                        )
            else:
                val = CronValidator._parse_value(field_name, base, errors)
                if val is not None and (val < lo or val > hi):
                    # weekday 7 == 0 (Sunday) is valid
                    if not (field_name == "weekday" and val == 7):
                        errors.append(
                            f"{field_name}: value {val} out of range [{lo},{hi}]"
                        )
        return errors

    @staticmethod
    def _parse_value(field_name: str, token: str, errors: List[str]) -> int | None:
        """Parse a single value, resolving month/weekday names."""
        token = token.strip().lower()
        if not token:
            errors.append(f"{field_name}: empty value")
            return None
        if token.isdigit():
            return int(token)
        if field_name == "month" and token in _MONTH_NAMES:
            return _MONTH_NAMES[token]
        if field_name == "weekday" and token in _WEEKDAY_NAMES:
            return _WEEKDAY_NAMES[token]
        errors.append(f"{field_name}: invalid value '{token}'")
        return None

    # ------------------------------------------------------------------ #
    # script / permission validation
    # ------------------------------------------------------------------ #
    def _validate_script(self, task: TaskEntry, result: ValidationResult) -> None:
        script_path = task.script_path
        if not script_path:
            result.issues.append(
                "No script path could be extracted from the command"
            )
            return

        if not os.path.exists(script_path):
            result.script_exists = False
            result.issues.append(f"Script not found: {script_path}")
            return

        result.script_exists = True

        if os.path.isdir(script_path):
            result.is_executable = False
            result.issues.append(f"Script path is a directory: {script_path}")
            return

        try:
            st = os.stat(script_path)
        except OSError as exc:
            result.issues.append(f"Cannot stat script {script_path}: {exc}")
            return

        result.permission_octal = oct(st.st_mode & 0o777)

        mode = st.st_mode
        is_exec = bool(mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH))
        result.is_executable = is_exec

        if not is_exec:
            result.issues.append(
                f"Script not executable (perms {result.permission_octal}): "
                f"{script_path}"
            )

        # Check for world-writable scripts (security risk)
        if mode & stat.S_IWOTH:
            result.issues.append(
                f"Script is world-writable (perms {result.permission_octal}): "
                f"{script_path}"
            )

    # ------------------------------------------------------------------ #
    # status aggregation
    # ------------------------------------------------------------------ #
    @staticmethod
    def _compute_status(result: ValidationResult) -> TaskStatus:
        if not result.cron_expression_valid:
            return TaskStatus.ERROR

        if result.script_exists is False:
            return TaskStatus.ERROR

        if result.is_executable is False:
            return TaskStatus.ERROR

        # Warnings: script exists and is executable but has issues
        # (e.g. world-writable) or no script path was extracted.
        if result.issues:
            return TaskStatus.WARNING

        if result.script_exists is None:
            return TaskStatus.UNKNOWN

        return TaskStatus.OK
