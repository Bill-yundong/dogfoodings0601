"""DNS detector — resolves live A/CNAME/MX records via raw UDP sockets.

Instead of relying on a third-party DNS library, this module speaks the
DNS wire protocol directly: it hand-crafts query packets, sends them over
a standard ``socket`` UDP datagram, and parses the binary response back
into Python objects.  This keeps the tool dependency-light while still
supporting the three record types (A, CNAME, MX) needed for drift auditing.
"""

import random
import socket
import struct

TYPE_A = 1
TYPE_CNAME = 5
TYPE_MX = 15
CLASS_IN = 1

RCODE_LABELS = {
    0: "NOERROR",
    1: "FORMERR",
    2: "SERVFAIL",
    3: "NXDOMAIN",
    4: "NOTIMP",
    5: "REFUSED",
}

_QTYPE_MAP = {
    "A": TYPE_A,
    "CNAME": TYPE_CNAME,
    "MX": TYPE_MX,
}


class DNSError(Exception):
    def __init__(self, rcode, domain, qtype):
        self.rcode = rcode
        self.domain = domain
        self.qtype = qtype
        label = RCODE_LABELS.get(rcode, f"RCODE({rcode})")
        super().__init__(f"DNS query for {qtype} {domain} returned {label}")


class DNSTimeout(Exception):
    pass


def _encode_name(domain):
    parts = [p for p in domain.rstrip(".").split(".") if p]
    buf = bytearray()
    for part in parts:
        encoded = part.encode("ascii")
        if len(encoded) > 63:
            raise ValueError(f"Label too long: {part}")
        buf.append(len(encoded))
        buf.extend(encoded)
    buf.append(0)
    return bytes(buf)


def _parse_name(data, offset):
    labels = []
    jumped = False
    return_offset = offset
    safety = 0
    while True:
        safety += 1
        if safety > 128:
            raise ValueError("DNS name compression loop detected")
        length = data[offset]
        if length == 0:
            offset += 1
            if not jumped:
                return_offset = offset
            break
        if (length & 0xC0) == 0xC0:
            if not jumped:
                return_offset = offset + 2
            pointer = ((length & 0x3F) << 8) | data[offset + 1]
            offset = pointer
            jumped = True
            continue
        offset += 1
        labels.append(data[offset:offset + length].decode("ascii", "replace"))
        offset += length
    name = ".".join(labels)
    return name, return_offset


class RawDNSClient:
    def __init__(self, server, port=53, timeout=5):
        self.server = (server, port)
        self.timeout = timeout

    def _build_query(self, domain, qtype):
        tid = random.randint(0, 65535)
        flags = 0x0100
        header = struct.pack(">HHHHHH", tid, flags, 1, 0, 0, 0)
        question = _encode_name(domain) + struct.pack(">HH", qtype, CLASS_IN)
        return tid, header + question

    def _transact(self, domain, qtype):
        tid, packet = self._build_query(domain, qtype)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(self.timeout)
        try:
            sock.sendto(packet, self.server)
            data, _ = sock.recvfrom(65535)
        except socket.timeout:
            raise DNSTimeout(
                f"DNS query timed out after {self.timeout}s for {domain}"
            )
        finally:
            sock.close()

        if len(data) < 12:
            raise ValueError("DNS response too short (header < 12 bytes)")

        resp_tid = struct.unpack(">H", data[:2])[0]
        if resp_tid != tid:
            raise ValueError(
                f"Transaction ID mismatch: expected {tid}, got {resp_tid}"
            )
        return data

    def query(self, domain, qtype_name):
        qtype = _QTYPE_MAP.get(qtype_name.upper())
        if qtype is None:
            raise ValueError(f"Unsupported record type: {qtype_name}")

        domain = domain.rstrip(".").lower()
        data = self._transact(domain, qtype)

        flags, qdcount, ancount = struct.unpack(">HHH", data[2:8])
        rcode = flags & 0x000F
        offset = 12

        for _ in range(qdcount):
            _, offset = _parse_name(data, offset)
            offset += 4

        answers = []
        for _ in range(ancount):
            name, offset = _parse_name(data, offset)
            rtype, rclass, ttl, rdlength = struct.unpack(
                ">HHIH", data[offset:offset + 10]
            )
            offset += 10
            rdata_start = offset
            rdata = data[offset:offset + rdlength]
            offset += rdlength

            if rtype == TYPE_A and rdlength == 4:
                ip = ".".join(str(b) for b in rdata)
                answers.append({"name": name, "value": ip, "ttl": ttl})
            elif rtype == TYPE_CNAME:
                cname, _ = _parse_name(data, rdata_start)
                answers.append({"name": name, "value": cname.rstrip("."), "ttl": ttl})
            elif rtype == TYPE_MX:
                preference = struct.unpack(">H", rdata[:2])[0]
                exchange, _ = _parse_name(data, rdata_start + 2)
                answers.append(
                    {
                        "name": name,
                        "value": f"{preference} {exchange.rstrip('.')}",
                        "ttl": ttl,
                    }
                )

        return rcode, answers


class DNSDetector:
    def __init__(self, server="8.8.8.8", port=53, timeout=5):
        self.client = RawDNSClient(server=server, port=port, timeout=timeout)

    def probe(self, domain, record_types):
        result = {}
        for rtype in record_types:
            rtype_upper = rtype.upper()
            if rtype_upper not in _QTYPE_MAP:
                continue
            try:
                rcode, answers = self.client.query(domain, rtype_upper)
            except DNSTimeout:
                result[rtype_upper] = {
                    "error": "timeout",
                    "records": [],
                }
                continue

            if rcode != 0:
                label = RCODE_LABELS.get(rcode, f"RCODE({rcode})")
                result[rtype_upper] = {
                    "error": label,
                    "records": [],
                }
                continue

            values = []
            for ans in answers:
                val = ans["value"].strip().lower()
                if rtype_upper in ("CNAME", "MX"):
                    val = val.rstrip(".").strip()
                if val:
                    values.append(val)
            result[rtype_upper] = {"error": None, "records": values}

        return result
