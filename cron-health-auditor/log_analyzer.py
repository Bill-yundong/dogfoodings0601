"""Syslog-based cron execution log analyzer.

Parses cron-related entries from system log files, correlates them with
known :class:`TaskEntry` objects and produces :class:`TaskStats`
summarising success rate and average duration per task.

Supported log formats
---------------------
Standard rsyslog lines emitted by the ``cron`` daemon::

    Jun 18 10:00:01 hostname CRON[12345]: (root) CMD (/usr/bin/backup.sh)
    Jun 18 10:01:02 hostname CRON[12345]: (root) MAIL (mailed 42 bytes ...)

The ``(user) CMD (command)`` lines mark a job start.  ``(user) MAIL``
or lines containing ``error`` / ``failed`` indicate that the job
produced output or failed.
"""

from __future__ import annotations

import os
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Tuple

from models import ExecutionRecord, TaskEntry, TaskStats

# Default locations to search for cron logs on Linux and macOS.
DEFAULT_LOG_PATHS = [
    "/var/log/syslog",
    "/var/log/cron",
    "/var/log/cron.log",
    "/var/log/system.log",
]

# Regex for a standard cron CMD / MAIL line.
#   group 1 = timestamp  (Jun 18 10:00:01)
#   group 2 = hostname
#   group 3 = pid
#   group 4 = user
#   group 5 = action   (CMD / MAIL / etc.)
#   group 6 = payload   (the command or mail info)
_CRON_LINE_RE = re.compile(
    r"^(?P<ts>\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>\S+)\s+"
    r"(?:\w+\s+)?"          # optional program name (cron / CRON)
    r"CRON\[(?P<pid>\d+)\]:\s+"
    r"\((?P<user>[^)]+)\)\s+"
    r"(?P<action>\w+)\s+"
    r"\((?P<payload>.*)\)\s*$",
    re.IGNORECASE,
)

# Alternative: some systems use lowercase ``cron`` without brackets.
_CRON_ALT_RE = re.compile(
    r"^(?P<ts>\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>\S+)\s+"
    r"cron(?:\[(?P<pid>\d+)\])?:\s+"
    r"\((?P<user>[^)]+)\)\s+"
    r"(?P<action>\w+)\s+"
    r"\((?P<payload>.*)\)\s*$",
    re.IGNORECASE,
)

# Keywords in a payload that signal failure.
_FAILURE_KEYWORDS = ("error", "fail", "not found", "permission denied",
                      "no such file", "command not found", "terminated",
                      "mail")


class LogAnalyzer:
    """Parse cron log files and compute per-task statistics.

    Parameters
    ----------
    log_paths:
        Explicit list of log file paths.  When *None* the analyzer tries
        the standard system locations.
    """

    def __init__(self, log_paths: Optional[Iterable[str]] = None):
        if log_paths is not None:
            self.log_paths = list(log_paths)
        else:
            self.log_paths = [p for p in DEFAULT_LOG_PATHS if os.path.exists(p)]

    # ------------------------------------------------------------------ #
    # public API
    # ------------------------------------------------------------------ #
    def analyze(
        self,
        tasks: List[TaskEntry],
        since: Optional[datetime] = None,
    ) -> Tuple[List[ExecutionRecord], List[TaskStats]]:
        """Parse logs, match records to *tasks*, return (records, stats)."""
        records = self.parse_logs(since=since)
        matched = self.match_records(records, tasks)
        stats = self.compute_stats(matched, tasks)
        return matched, stats

    # ------------------------------------------------------------------ #
    # log parsing
    # ------------------------------------------------------------------ #
    def parse_logs(
        self, since: Optional[datetime] = None
    ) -> List[ExecutionRecord]:
        records: List[ExecutionRecord] = []
        for path in self.log_paths:
            records.extend(self._parse_file(path, since))
        records.sort(key=lambda r: r.timestamp or datetime.min)
        return records

    def parse_content(
        self, content: str, since: Optional[datetime] = None
    ) -> List[ExecutionRecord]:
        """Parse log content from a string (useful for testing)."""
        return self._parse_lines(content.splitlines(), since)

    def _parse_file(
        self, path: str, since: Optional[datetime] = None
    ) -> List[ExecutionRecord]:
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                lines = fh.readlines()
        except (PermissionError, OSError):
            return []
        return self._parse_lines(lines, since)

    def _parse_lines(
        self, lines: Iterable[str], since: Optional[datetime] = None
    ) -> List[ExecutionRecord]:
        records: List[ExecutionRecord] = []
        # Track failure PIDs and timestamps for correlation.
        failure_events: List[Tuple[datetime, str, Optional[int]]] = []

        for line in lines:
            m = _CRON_LINE_RE.match(line) or _CRON_ALT_RE.match(line)
            if not m:
                continue

            ts = self._parse_timestamp(m.group("ts"))
            if ts is None:
                continue
            if since and ts < since:
                continue

            user = m.group("user")
            action = m.group("action").upper()
            payload = m.group("payload")
            pid_str = m.group("pid")
            pid = int(pid_str) if pid_str and pid_str.isdigit() else None

            if action == "CMD":
                is_failure = self._payload_indicates_failure(payload)
                records.append(ExecutionRecord(
                    timestamp=ts,
                    user=user,
                    command=payload.strip(),
                    pid=pid,
                    success=not is_failure,
                    duration=None,
                ))
            elif action == "MAIL" or self._payload_indicates_failure(payload):
                failure_events.append((ts, user, pid))

        # Second pass: correlate failures to CMD records by PID or user+time.
        self._correlate_failures(records, failure_events)
        return records

    def _correlate_failures(
        self,
        records: List[ExecutionRecord],
        failures: List[Tuple[datetime, str, Optional[int]]],
    ) -> None:
        """Mark CMD records as failed when a matching failure event exists."""
        if not failures:
            return

        by_pid: Dict[int, List[ExecutionRecord]] = defaultdict(list)
        for r in records:
            if r.pid is not None:
                by_pid[r.pid].append(r)

        for fts, fuser, fpid in failures:
            # Prefer exact PID match.
            if fpid is not None and fpid in by_pid:
                for r in by_pid[fpid]:
                    if r.user == fuser:
                        r.success = False
                        continue
            # Fall back to user + time proximity (within 5 minutes).
            for r in records:
                if r.user != fuser or not r.success:
                    continue
                if r.timestamp and abs((r.timestamp - fts).total_seconds()) < 300:
                    r.success = False

    # ------------------------------------------------------------------ #
    # matching records to tasks
    # ------------------------------------------------------------------ #
    def match_records(
        self, records: List[ExecutionRecord], tasks: List[TaskEntry]
    ) -> List[ExecutionRecord]:
        """Annotate records in-place and return those that matched a task."""
        task_index = self._build_task_index(tasks)
        matched: List[ExecutionRecord] = []

        for record in records:
            fp = self._match_record_to_task(record, tasks, task_index)
            if fp:
                matched.append(record)
        return matched

    @staticmethod
    def _build_task_index(tasks: List[TaskEntry]) -> Dict[str, TaskEntry]:
        """Build a lookup from normalised keys to tasks."""
        index: Dict[str, TaskEntry] = {}
        for task in tasks:
            keys = {task.fingerprint()}
            if task.script_path:
                keys.add(os.path.basename(task.script_path))
                keys.add(task.script_path)
            keys.add(task.command.strip())
            for key in keys:
                norm = _normalise(key)
                if norm:
                    index.setdefault(norm, task)
        return index

    @staticmethod
    def _match_record_to_task(
        record: ExecutionRecord,
        tasks: List[TaskEntry],
        task_index: Dict[str, TaskEntry],
    ) -> Optional[str]:
        """Return the fingerprint of the task matched by *record*."""
        cmd = record.command.strip()
        norm_cmd = _normalise(cmd)

        # 1. Exact normalised command match.
        if norm_cmd and norm_cmd in task_index:
            return task_index[norm_cmd].fingerprint()

        # 2. Match by basename of the first token.
        first_token = cmd.split()[0] if cmd else ""
        if "/" in first_token:
            basename = os.path.basename(first_token)
            norm_base = _normalise(basename)
            if norm_base and norm_base in task_index:
                return task_index[norm_base].fingerprint()

        # 3. Substring match: check if any task command is contained
        #    in the logged command or vice-versa.
        for task in tasks:
            tcmd = task.command.strip()
            if not tcmd:
                continue
            if tcmd in cmd or cmd in tcmd:
                return task.fingerprint()

        return None

    # ------------------------------------------------------------------ #
    # statistics
    # ------------------------------------------------------------------ #
    @staticmethod
    def compute_stats(
        records: List[ExecutionRecord], tasks: List[TaskEntry]
    ) -> List[TaskStats]:
        """Group records by fingerprint and compute summary statistics."""
        # Re-run matching to group correctly.
        index = LogAnalyzer._build_task_index(tasks)
        groups: Dict[str, List[ExecutionRecord]] = defaultdict(list)

        for r in records:
            fp = LogAnalyzer._match_record_to_task(r, tasks, index)
            if fp:
                groups[fp].append(r)

        stats_list: List[TaskStats] = []
        for fp, recs in groups.items():
            total = len(recs)
            success = sum(1 for r in recs if r.success)
            failure = total - success
            durations = [r.duration for r in recs if r.duration is not None]
            last_run = max((r.timestamp for r in recs if r.timestamp),
                           default=None)
            stats_list.append(TaskStats(
                fingerprint=fp,
                total_runs=total,
                success_count=success,
                failure_count=failure,
                success_rate=(success / total) if total else None,
                avg_duration=(sum(durations) / len(durations)) if durations else None,
                last_run=last_run,
            ))
        return stats_list

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _parse_timestamp(raw: str) -> Optional[datetime]:
        """Parse ``Mon DD HH:MM:SS`` inferring the year."""
        raw = raw.strip()
        # Normalise whitespace (some syslog lines pad single-digit days)
        raw = " ".join(raw.split())
        now = datetime.now()
        # Prepend current year to avoid Python 3.14 deprecation warning
        # about parsing dates without an explicit year.
        raw_with_year = f"{now.year} {raw}"
        try:
            parsed = datetime.strptime(raw_with_year, "%Y %b %d %H:%M:%S")
        except ValueError:
            return None

        ts = parsed
        # If the inferred date is more than 1 day in the future, it
        # probably belongs to the previous year.
        if ts - now > timedelta(days=1):
            ts = ts.replace(year=now.year - 1)
        return ts

    @staticmethod
    def _payload_indicates_failure(payload: str) -> bool:
        lowered = payload.lower()
        return any(kw in lowered for kw in _FAILURE_KEYWORDS)


def _normalise(text: str) -> str:
    """Normalise a command string for comparison."""
    return re.sub(r"\s+", " ", text.strip().lower())
