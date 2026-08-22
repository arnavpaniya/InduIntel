"""SSRF protection and security utilities for evidence retrieval."""

import re
import ipaddress
from urllib.parse import urlparse

BLOCKED_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "metadata.google.internal"}
BLOCKED_IP_PATTERNS = [
    re.compile(r"^10\."),
    re.compile(r"^192\.168\."),
    re.compile(r"^172\.(1[6-9]|2[0-9]|3[0-1])\."),
    re.compile(r"^169\.254\."),
    re.compile(r"^0\."),
]


def is_blocked_host(hostname):
    """Return True if hostname is blocked (localhost/private/metadata)."""
    host = (hostname or "").lower().strip()
    if not host:
        return True
    if host in BLOCKED_HOSTNAMES:
        return True
    for pattern in BLOCKED_IP_PATTERNS:
        if pattern.match(host):
            return True
    # Resolve literal IPs and classify them
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return True
    except ValueError:
        pass  # Not an IP literal; hostname check above applies
    return False


def validate_url(url):
    """Validate a URL for safe retrieval. Returns (ok, reason)."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "URL parse failed"
    if parsed.scheme not in ("http", "https"):
        return False, f"Scheme not allowed: {parsed.scheme}"
    hostname = parsed.hostname or ""
    if is_blocked_host(hostname):
        return False, f"Blocked host: {hostname}"
    return True, ""
