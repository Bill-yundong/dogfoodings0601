"""SSL certificate inspection.

For each domain we open a TLS connection, pull the certificate chain and
parse the server certificate's expiration date and issuer. Results are
classified into severity levels based on the remaining days.

A deliberately *unverified* SSL context is used so that already-expired or
self-signed certificates can still be retrieved and inspected -- the whole
point of an expiration monitor is to detect certificates that have gone
bad, not to fail when they do.
"""

from __future__ import annotations

import socket
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

from cryptography import x509
from cryptography.hazmat.backends import default_backend

from .config import Thresholds

LEVEL_EXPIRED = "expired"
LEVEL_CRITICAL = "critical"
LEVEL_WARNING = "warning"
LEVEL_SAFE = "safe"
LEVEL_ERROR = "error"

# Levels that should trigger an alert email.
ALERT_LEVELS = {LEVEL_EXPIRED, LEVEL_CRITICAL, LEVEL_WARNING}

LEVEL_ORDER = {
    LEVEL_ERROR: 0,
    LEVEL_EXPIRED: 1,
    LEVEL_CRITICAL: 2,
    LEVEL_WARNING: 3,
    LEVEL_SAFE: 4,
}


def _build_context() -> ssl.SSLContext:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _get_chain_der(ssock: ssl.SSLSocket) -> List[bytes]:
    """Return the raw DER-encoded certificate chain sent by the server."""
    raw_chain = getattr(ssock, "get_unverified_chain", None)
    if raw_chain is not None:
        try:
            chain = raw_chain()
            if chain:
                return list(chain)
        except Exception:
            pass
    der = ssock.getpeercert(binary_form=True)
    return [der] if der else []


def _not_after(cert: x509.Certificate) -> datetime:
    try:
        return cert.not_valid_after_utc
    except AttributeError:
        return cert.not_valid_after.replace(tzinfo=timezone.utc)


def _not_before(cert: x509.Certificate) -> datetime:
    try:
        return cert.not_valid_before_utc
    except AttributeError:
        return cert.not_valid_before.replace(tzinfo=timezone.utc)


def _parse_cert(der: bytes) -> Dict[str, str]:
    cert = x509.load_der_x509_certificate(der, default_backend())
    return {
        "subject": cert.subject.rfc4514_string(),
        "issuer": cert.issuer.rfc4514_string(),
        "not_before": _not_before(cert).isoformat(),
        "not_after": _not_after(cert).isoformat(),
    }


def classify(remaining_days: Optional[int], thresholds: Thresholds) -> str:
    """Map a remaining-days value to a severity level."""
    if remaining_days is None:
        return LEVEL_ERROR
    if remaining_days < 0:
        return LEVEL_EXPIRED
    if remaining_days <= thresholds.critical:
        return LEVEL_CRITICAL
    if remaining_days <= thresholds.warning:
        return LEVEL_WARNING
    return LEVEL_SAFE


RETRYABLE_ERRORS = (ConnectionError, socket.timeout, ssl.SSLError)


def _inspect_once(
    domain: str, port: int, timeout: int, thresholds: Thresholds, result: Dict
) -> None:
    """Perform a single inspection attempt.

    Mutates ``result`` in place on success and raises on failure so the caller
    can decide whether to retry.
    """
    ctx = _build_context()
    with socket.create_connection((domain, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
            der_chain = _get_chain_der(ssock)

    parsed = [_parse_cert(der) for der in der_chain]
    result["chain"] = parsed

    if not parsed:
        raise RuntimeError("No certificate returned by server")

    server = parsed[0]
    not_after = datetime.fromisoformat(server["not_after"])
    remaining = (not_after - datetime.now(timezone.utc)).days
    result["server_certificate"] = server
    result["remaining_days"] = remaining
    result["level"] = classify(remaining, thresholds)
    result["status"] = "success"
    result["error"] = None


def inspect_domain(
    domain: str,
    port: int,
    timeout: int,
    thresholds: Thresholds,
    max_retries: int = 2,
    retry_backoff: float = 1.0,
) -> Dict:
    """Inspect a single domain, retrying transient connection failures.

    Transient errors (connection resets, timeouts, handshake hiccups) are
    retried up to ``max_retries`` times with a linear backoff. Permanent
    failures such as DNS resolution errors are reported immediately.
    """
    result: Dict = {
        "domain": domain,
        "port": port,
        "status": "error",
        "error": None,
        "level": LEVEL_ERROR,
        "remaining_days": None,
        "server_certificate": None,
        "chain": [],
        "inspected_at": datetime.now(timezone.utc).isoformat(),
    }
    last_exc: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            _inspect_once(domain, port, timeout, thresholds, result)
            return result
        except RETRYABLE_ERRORS as exc:
            last_exc = exc
            if attempt < max_retries:
                time.sleep(retry_backoff * (attempt + 1))
                continue
            result["error"] = f"{type(exc).__name__}: {exc}"
            return result
        except Exception as exc:
            result["error"] = f"{type(exc).__name__}: {exc}"
            return result
    if last_exc is not None:
        result["error"] = f"{type(last_exc).__name__}: {last_exc}"
    return result


def inspect_domains(
    domains: List[Dict],
    thresholds: Thresholds,
    timeout: int,
    concurrency: int,
    max_retries: int = 2,
    retry_backoff: float = 1.0,
    progress: Optional[Callable[[Dict], None]] = None,
) -> List[Dict]:
    """Inspect a batch of domains concurrently, returning results sorted by
    severity (worst first) then domain name."""
    results: List[Dict] = []

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {
            pool.submit(
                inspect_domain,
                d["name"],
                d["port"],
                timeout,
                thresholds,
                max_retries,
                retry_backoff,
            ): d
            for d in domains
        }
        for future in as_completed(futures):
            res = future.result()
            if progress is not None:
                progress(res)
            results.append(res)

    results.sort(
        key=lambda r: (LEVEL_ORDER.get(r["level"], 99), r["domain"])
    )
    return results
