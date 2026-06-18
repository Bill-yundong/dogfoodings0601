"""Email alerting.

Alerts are triggered for any domain whose level falls within the configured
thresholds (warning / critical / expired). The alert message is always
written to an ``.eml`` file so it is visible without a mail server; when
``smtp.enabled`` is true the message is additionally delivered over SMTP.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from email.utils import formatdate
from datetime import datetime, timezone
from typing import Dict, List

from .config import Config
from .inspector import (
    ALERT_LEVELS,
    LEVEL_CRITICAL,
    LEVEL_ERROR,
    LEVEL_EXPIRED,
    LEVEL_WARNING,
)


_LEVEL_LABEL = {
    LEVEL_EXPIRED: "EXPIRED",
    LEVEL_CRITICAL: "CRITICAL",
    LEVEL_WARNING: "WARNING",
    LEVEL_ERROR: "ERROR",
}


def _format_not_after(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    except (TypeError, ValueError):
        return iso or "N/A"


def build_alert(results: List[Dict], config: Config) -> Dict:
    """Build the alert subject/body and the underlying MIME message."""
    alert_results = [r for r in results if r["level"] in ALERT_LEVELS]
    counts = {LEVEL_EXPIRED: 0, LEVEL_CRITICAL: 0, LEVEL_WARNING: 0}
    for r in alert_results:
        counts[r["level"]] = counts.get(r["level"], 0) + 1

    summary_bits = []
    if counts[LEVEL_EXPIRED]:
        summary_bits.append(f"{counts[LEVEL_EXPIRED]} expired")
    if counts[LEVEL_CRITICAL]:
        summary_bits.append(f"{counts[LEVEL_CRITICAL]} critical")
    if counts[LEVEL_WARNING]:
        summary_bits.append(f"{counts[LEVEL_WARNING]} warning")

    if not alert_results:
        subject = "[SSL Inspection] No alerts - all certificates healthy"
    else:
        subject = (
            f"[SSL Alert] {len(alert_results)} domain(s) need attention "
            f"({', '.join(summary_bits)})"
        )

    lines: List[str] = []
    lines.append("SSL Certificate Inspection Alert")
    lines.append("=" * 40)
    lines.append(f"Generated: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"Thresholds: warning<={config.thresholds.warning}d, "
                 f"critical<={config.thresholds.critical}d, expired<0d")
    lines.append("")

    if not alert_results:
        lines.append("All inspected certificates are within safe limits.")
    else:
        lines.append(f"Affected domains ({len(alert_results)}):")
        lines.append("-" * 40)
        for r in alert_results:
            server = r.get("server_certificate") or {}
            remaining = r.get("remaining_days")
            remaining_str = (
                "expired" if remaining is not None and remaining < 0
                else f"{remaining} days" if remaining is not None
                else "unknown"
            )
            lines.append(f"  [{_LEVEL_LABEL.get(r['level'], r['level'])}] "
                         f"{r['domain']}:{r['port']}")
            lines.append(f"      remaining : {remaining_str}")
            lines.append(f"      expires   : {_format_not_after(server.get('not_after'))}")
            if server.get("issuer"):
                lines.append(f"      issuer    : {server['issuer']}")
            if r.get("error"):
                lines.append(f"      error     : {r['error']}")
            lines.append("")

    body = "\n".join(lines)

    smtp = config.alert.smtp
    msg = EmailMessage()
    msg["From"] = smtp.from_addr
    msg["To"] = ", ".join(smtp.to) if smtp.to else smtp.from_addr
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False)
    try:
        # 7bit keeps ASCII bodies human-readable in the .eml file (no =3D escapes).
        msg.set_content(body, cte="7bit")
    except (UnicodeEncodeError, ValueError):
        msg.set_content(body)

    return {
        "subject": subject,
        "body": body,
        "message": msg,
        "alert_count": len(alert_results),
        "counts": counts,
        "alert_results": alert_results,
    }


def write_alert_eml(alert: Dict, path: str) -> str:
    """Persist the alert message as an .eml file."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(alert["message"].as_string())
    return path


def send_alert_smtp(alert: Dict, config: Config) -> Dict:
    """Deliver the alert via SMTP. Returns a small status dict."""
    smtp = config.alert.smtp
    status = {"sent": False, "error": None}
    if not smtp.enabled:
        status["error"] = "SMTP disabled in config"
        return status
    if not smtp.to:
        status["error"] = "No recipients configured (alert.smtp.to)"
        return status
    try:
        with smtplib.SMTP(smtp.host, smtp.port, timeout=30) as server:
            if smtp.use_tls:
                server.starttls()
            if smtp.username:
                server.login(smtp.username, smtp.password)
            server.sendmail(
                smtp.from_addr, smtp.to, alert["message"].as_string()
            )
        status["sent"] = True
    except Exception as exc:
        status["error"] = f"{type(exc).__name__}: {exc}"
    return status


def handle_alerts(results: List[Dict], config: Config) -> Dict:
    """End-to-end alert handling: build message, write .eml, optionally send."""
    alert = build_alert(results, config)
    eml_path = write_alert_eml(alert, config.alert.email_path)
    send_status = send_alert_smtp(alert, config)
    return {
        "subject": alert["subject"],
        "body": alert["body"],
        "eml_path": eml_path,
        "alert_count": alert["alert_count"],
        "counts": alert["counts"],
        "smtp": send_status,
    }
