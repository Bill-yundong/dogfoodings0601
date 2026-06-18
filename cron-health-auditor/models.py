"""Data models for the cron health auditor.

This module defines the core data structures that flow between the
scanner, validator, log analyzer and database layers.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class TaskStatus(enum.Enum):
    """Overall health status for a single crontab task."""

    OK = "OK"
    WARNING = "WARNING"
    ERROR = "ERROR"
    UNKNOWN = "UNKNOWN"


@dataclass
class TaskEntry:
    """A single crontab task entry parsed from a crontab file.

    Attributes:
        source: The file path or descriptor this entry came from
            (e.g. ``/etc/crontab``, ``/etc/cron.d/backup``).
        user: The user the task runs as. For per-user crontabs this is
            the owner; for system crontabs it is the field after the
            schedule. ``None`` when unknown.
        minute / hour / day / month / weekday: Individual cron fields
            kept as raw strings for validation and display.
        cron_expression: The full 5-field cron schedule string.
        command: The raw command string to be executed.
        script_path: The executable script path extracted from
            ``command`` if one could be determined, otherwise ``None``.
        environment: Mapping of environment variables declared in the
            same crontab file (e.g. ``SHELL``, ``PATH``).
        line_number: 1-based line number within ``source``.
        comment: Optional inline comment from the crontab line.
    """

    source: str
    cron_expression: str
    command: str
    minute: str = ""
    hour: str = ""
    day: str = ""
    month: str = ""
    weekday: str = ""
    user: Optional[str] = None
    script_path: Optional[str] = None
    environment: dict = field(default_factory=dict)
    line_number: int = 0
    comment: str = ""

    def fingerprint(self) -> str:
        """Return a stable identifier for deduplication and matching.

        The fingerprint is based on the cron expression and command so
        the same task can be correlated across scans and syslog entries.
        """
        return f"{self.cron_expression}|{self.command}"


@dataclass
class ValidationResult:
    """Result of validating a single :class:`TaskEntry`.

    Attributes:
        task: The task that was validated.
        cron_expression_valid: Whether the cron schedule parses.
        cron_expression_errors: Human readable errors for the schedule.
        script_exists: Whether ``script_path`` exists on disk.
        is_executable: Whether the script has the executable bit set.
        permission_octal: Octal permission string e.g. ``0o755``.
        issues: List of human readable issue descriptions.
        status: Aggregated :class:`TaskStatus`.
    """

    task: TaskEntry
    cron_expression_valid: bool = True
    cron_expression_errors: list = field(default_factory=list)
    script_exists: Optional[bool] = None
    is_executable: Optional[bool] = None
    permission_octal: Optional[str] = None
    issues: list = field(default_factory=list)
    status: TaskStatus = TaskStatus.UNKNOWN

    def to_dict(self) -> dict:
        return {
            "source": self.task.source,
            "user": self.task.user,
            "cron_expression": self.task.cron_expression,
            "command": self.task.command,
            "script_path": self.task.script_path,
            "cron_expression_valid": self.cron_expression_valid,
            "cron_expression_errors": "; ".join(self.cron_expression_errors),
            "script_exists": self.script_exists,
            "is_executable": self.is_executable,
            "permission_octal": self.permission_octal,
            "issues": "; ".join(self.issues),
            "status": self.status.value,
        }


@dataclass
class ExecutionRecord:
    """A single cron execution record extracted from syslog.

    Attributes:
        timestamp: When the execution started.
        user: The user that ran the task.
        command: The command string as logged.
        pid: Process id if available.
        success: ``True`` if the command completed successfully.
        duration: Wall-clock duration in seconds if it can be
            determined, otherwise ``None``.
    """

    timestamp: datetime
    user: str
    command: str
    pid: Optional[int] = None
    success: bool = True
    duration: Optional[float] = None


@dataclass
class TaskStats:
    """Aggregated execution statistics for one task.

    Attributes:
        fingerprint: Matches :meth:`TaskEntry.fingerprint`.
        total_runs: Number of executions observed.
        success_count: How many succeeded.
        failure_count: How many failed.
        success_rate: ``success_count / total_runs`` or ``None``.
        avg_duration: Mean duration in seconds or ``None``.
        last_run: Timestamp of the most recent execution.
    """

    fingerprint: str
    total_runs: int = 0
    success_count: int = 0
    failure_count: int = 0
    success_rate: Optional[float] = None
    avg_duration: Optional[float] = None
    last_run: Optional[datetime] = None


@dataclass
class ReportRecord:
    """A full health report snapshot.

    Attributes:
        created_at: When the report was generated.
        total_tasks: Number of tasks scanned.
        healthy_tasks: Tasks with status ``OK``.
        warning_tasks: Tasks with status ``WARNING``.
        error_tasks: Tasks with status ``ERROR``.
        overall_health_score: 0-100 score.
        details: Per-task rows (validation + stats merged).
    """

    created_at: datetime
    total_tasks: int = 0
    healthy_tasks: int = 0
    warning_tasks: int = 0
    error_tasks: int = 0
    overall_health_score: float = 0.0
    details: list = field(default_factory=list)
