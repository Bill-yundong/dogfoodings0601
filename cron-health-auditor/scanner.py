"""Crontab file scanner.

Parses system and per-user crontab files and produces :class:`TaskEntry`
objects.  The scanner is deliberately tolerant: missing files or
directories are skipped silently so the tool works on both Linux and
macOS where crontab locations differ.
"""

from __future__ import annotations

import glob
import os
import re
import shlex
import subprocess
from dataclasses import replace
from typing import Iterable, List, Optional, Tuple

from models import TaskEntry

# Mapping of @-style schedule macros to their 5-field equivalents.
SPECIAL_TIMES = {
    "@reboot": "@reboot",
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@hourly": "0 * * * *",
}

# Shell operators that separate commands within a single crontab entry.
_SHELL_OPS = re.compile(r"\s*(?:&&|\|\||;|\||>|<)\s*")

# Environment variable assignment at the start of a command segment,
# e.g. ``FOO=bar BAZ=qux /opt/script.sh``
_ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=\S+\s*")

# Directories that may contain per-user crontab spool files on Linux.
_USER_SPOOL_DIRS = [
    "/var/spool/cron/crontabs",
    "/var/spool/cron",
]

# Directories that may contain per-user crontab spool files on macOS.
_MAC_SPOOL_DIR = "/usr/lib/cron/tabs"


class CronScanner:
    """Scan crontab files and yield :class:`TaskEntry` objects.

    Parameters
    ----------
    sources:
        Optional explicit list of paths.  Each path may be a file or a
        directory (directories are expanded to their non-dot files).
        When ``None`` the scanner auto-discovers the standard system
        and per-user crontab locations.
    include_user_crontab:
        When *True* (default) the output of ``crontab -l`` for the
        current user is also scanned.
    """

    def __init__(
        self,
        sources: Optional[Iterable[str]] = None,
        include_user_crontab: bool = True,
        force_system: bool = False,
    ):
        if sources is not None:
            self.sources = list(sources)
        else:
            self.sources = self._default_sources()
        self.include_user_crontab = include_user_crontab
        self.force_system = force_system

    # ------------------------------------------------------------------ #
    # public API
    # ------------------------------------------------------------------ #
    def scan(self) -> List[TaskEntry]:
        tasks: List[TaskEntry] = []
        for source in self.sources:
            is_system = self.force_system or self._is_system_path(source)
            tasks.extend(self._scan_path(source, is_system=is_system))

        if self.include_user_crontab and not self._has_explicit_sources():
            user_tasks = self._scan_current_user_crontab()
            tasks.extend(user_tasks)

        return tasks

    # ------------------------------------------------------------------ #
    # source discovery
    # ------------------------------------------------------------------ #
    @staticmethod
    def _default_sources() -> List[str]:
        sources: List[str] = ["/etc/crontab", "/etc/cron.d"]
        sources.extend(_USER_SPOOL_DIRS)
        if os.path.isdir(_MAC_SPOOL_DIR):
            sources.append(_MAC_SPOOL_DIR)
        return sources

    def _has_explicit_sources(self) -> bool:
        return len(self.sources) > 0 and self.sources != self._default_sources()

    @staticmethod
    def _is_system_path(path: str) -> bool:
        return path.startswith("/etc/crontab") or path.startswith("/etc/cron.d")

    def _scan_path(self, path: str, is_system: bool) -> List[TaskEntry]:
        if not os.path.exists(path):
            return []

        if os.path.isdir(path):
            return self._scan_directory(path, is_system)
        return self._scan_file(path, is_system)

    def _scan_directory(self, dir_path: str, is_system: bool) -> List[TaskEntry]:
        tasks: List[TaskEntry] = []
        for entry in sorted(glob.glob(os.path.join(dir_path, "*"))):
            if os.path.isdir(entry):
                continue
            if os.path.basename(entry).startswith("."):
                continue
            tasks.extend(self._scan_file(entry, is_system))
        return tasks

    # ------------------------------------------------------------------ #
    # file parsing
    # ------------------------------------------------------------------ #
    def _scan_file(self, path: str, is_system: bool) -> List[TaskEntry]:
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                content = fh.read()
        except PermissionError:
            return []
        except OSError:
            return []
        return self._parse_content(content, path, is_system)

    def _scan_current_user_crontab(self) -> List[TaskEntry]:
        try:
            result = subprocess.run(
                ["crontab", "-l"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return []
        if result.returncode != 0:
            return []
        return self._parse_content(
            result.stdout, source="crontab -l (current user)", is_system=False
        )

    def _parse_content(
        self, content: str, source: str, is_system: bool
    ) -> List[TaskEntry]:
        tasks: List[TaskEntry] = []
        env: dict = {}

        for lineno, raw_line in enumerate(content.splitlines(), start=1):
            line = raw_line.strip()

            if not line or line.startswith("#"):
                continue

            # Environment variable declaration: KEY=value or KEY = value
            env_match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
            if env_match and self._looks_like_env_assignment(line):
                key, value = env_match.group(1), env_match.group(2).strip()
                env[key] = value
                continue

            task = self._parse_task_line(line, source, lineno, env, is_system)
            if task is not None:
                tasks.append(task)

        return tasks

    @staticmethod
    def _looks_like_env_assignment(line: str) -> bool:
        """Distinguish ``KEY=value`` from a command that happens to contain ``=``.

        A crontab environment line has the form ``KEY=value`` where *value*
        is optional.  A task line always starts with a cron field or
        ``@`` macro.  If the part before ``=`` is a single bareword and
        the line does not start with a digit, ``*``, ``@`` or ``/`` we
        treat it as an environment assignment.
        """
        if line.startswith(("@", "*", "/", "0", "1", "2", "3", "4", "5",
                            "6", "7", "8", "9")):
            return False
        before_eq = line.split("=", 1)[0].strip()
        return bool(re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", before_eq))

    def _parse_task_line(
        self,
        line: str,
        source: str,
        lineno: int,
        env: dict,
        is_system: bool,
    ) -> Optional[TaskEntry]:
        parts = line.split(None, 5)
        if len(parts) < 2:
            return None

        # Handle @-style macros
        if parts[0].startswith("@"):
            macro = parts[0].lower()
            if macro not in SPECIAL_TIMES:
                return None
            cron_expr = SPECIAL_TIMES[macro]
            # For @-style: capture everything after the macro token
            at_parts = line.split(None, 1)
            remainder = at_parts[1] if len(at_parts) > 1 else ""
        else:
            if len(parts) < 6:
                return None
            cron_fields = parts[:5]
            cron_expr = " ".join(cron_fields)
            remainder = parts[5]

        # System crontabs have an extra user field between schedule and command
        if is_system:
            user_parts = remainder.split(None, 1)
            if len(user_parts) < 2:
                return None
            user = user_parts[0]
            command = user_parts[1]
        else:
            user = None
            command = remainder

        if not command:
            return None

        script_path = extract_script_path(command, env.get("PATH"))

        minute = hour = day = month = weekday = ""
        if not parts[0].startswith("@"):
            minute, hour, day, month, weekday = parts[:5]

        comment = ""
        if "#" in command:
            hash_pos = self._find_comment_hash(command)
            if hash_pos != -1:
                comment = command[hash_pos + 1:].strip()
                command = command[:hash_pos].rstrip()

        return TaskEntry(
            source=source,
            cron_expression=cron_expr,
            command=command,
            minute=minute,
            hour=hour,
            day=day,
            month=month,
            weekday=weekday,
            user=user,
            script_path=script_path,
            environment=dict(env),
            line_number=lineno,
            comment=comment,
        )

    @staticmethod
    def _find_comment_hash(command: str) -> int:
        """Find the position of a ``#`` that starts an inline comment.

        We must avoid ``#`` inside quoted strings or that is part of a
        shell expansion like ``${VAR#pattern}``.
        """
        in_single = in_double = False
        i = 0
        while i < len(command):
            ch = command[i]
            if ch == "'" and not in_double:
                in_single = not in_single
            elif ch == '"' and not in_single:
                in_double = not in_double
            elif ch == "#" and not in_single and not in_double:
                if i == 0 or command[i - 1].isspace():
                    return i
            i += 1
        return -1


# ---------------------------------------------------------------------- #
# module-level helpers
# ---------------------------------------------------------------------- #
def extract_script_path(command: str, path_env: Optional[str] = None) -> Optional[str]:
    """Extract the first executable script path from a crontab command.

    The function strips environment-variable assignments and shell
    operators, then inspects the first remaining token.  If the token
    looks like a path (contains ``/``) it is returned as-is.  Otherwise
    the function searches ``$PATH`` (optionally overridden by
    *path_env*) and returns the resolved path if found.
    """
    segments = _SHELL_OPS.split(command)
    if not segments:
        return None

    first_segment = segments[0].strip()
    if not first_segment:
        return None

    # Strip leading env-var assignments: FOO=bar BAZ=qux /path/to/script
    while True:
        m = _ENV_ASSIGN.match(first_segment)
        if not m:
            break
        first_segment = first_segment[m.end():].strip()
        if not first_segment:
            return None

    try:
        tokens = shlex.split(first_segment)
    except ValueError:
        tokens = first_segment.split()

    if not tokens:
        return None

    candidate = tokens[0]

    if "/" in candidate or candidate.startswith("."):
        return os.path.normpath(candidate)

    return _which(candidate, path_env)


def _which(command: str, path_env: Optional[str] = None) -> Optional[str]:
    """Minimal ``which`` implementation that honours a custom PATH."""
    search_path = path_env or os.environ.get("PATH", "")
    if not search_path:
        return None
    for directory in search_path.split(os.pathsep):
        candidate = os.path.join(directory.strip(), command)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None
