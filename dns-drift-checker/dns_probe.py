import socket
import struct
import random
from typing import List, Tuple, Dict, Any, Optional


DNS_RECORD_TYPES = {
    "A": 1,
    "CNAME": 5,
    "MX": 15,
}

TYPE_NAMES = {v: k for k, v in DNS_RECORD_TYPES.items()}

DNS_CLASS_IN = 1


class DNSProbe:
    def __init__(self, resolver: str = "8.8.8.8", timeout: float = 5.0, retries: int = 2):
        self.resolver = resolver
        self.timeout = timeout
        self.retries = retries

    def _build_query(self, domain: str, qtype: int) -> bytes:
        txn_id = random.randint(0, 0xFFFF)
        flags = 0x0100
        qdcount = 1
        header = struct.pack(">HHHHHH", txn_id, flags, qdcount, 0, 0, 0)

        question = b""
        for label in domain.rstrip(".").split("."):
            label_bytes = label.encode("ascii")
            question += bytes([len(label_bytes)]) + label_bytes
        question += b"\x00"
        question += struct.pack(">HH", qtype, DNS_CLASS_IN)
        return header + question

    def _parse_name(self, data: bytes, offset: int) -> Tuple[str, int]:
        labels: List[str] = []
        original_offset = offset
        jumped = False
        max_jumps = 10
        jumps = 0

        while True:
            if offset >= len(data):
                raise ValueError("Offset out of bounds while parsing DNS name")

            length = data[offset]

            if (length & 0xC0) == 0xC0:
                if offset + 1 >= len(data):
                    raise ValueError("Truncated compression pointer")
                if not jumped:
                    original_offset = offset + 2
                pointer = struct.unpack(">H", data[offset:offset + 2])[0] & 0x3FFF
                offset = pointer
                jumped = True
                jumps += 1
                if jumps > max_jumps:
                    raise ValueError("Too many DNS name compression jumps")
                continue

            if length == 0:
                offset += 1
                break

            offset += 1
            if offset + length > len(data):
                raise ValueError("Label length exceeds data")
            labels.append(data[offset:offset + length].decode("ascii", errors="replace"))
            offset += length

        final_offset = original_offset if jumped else offset
        return ".".join(labels), final_offset

    def _parse_response(self, data: bytes, expected_qtype: int) -> Dict[str, List[str]]:
        if len(data) < 12:
            raise ValueError("DNS response too short")

        txn_id, flags, qdcount, ancount, _, _ = struct.unpack(">HHHHHH", data[:12])

        rcode = flags & 0x000F
        if rcode != 0:
            return {"results": [], "status": f"rcode={rcode}"}

        offset = 12

        for _ in range(qdcount):
            _, offset = self._parse_name(data, offset)
            offset += 4

        results: Dict[int, List[str]] = {}
        results[expected_qtype] = []

        for _ in range(ancount):
            _, offset = self._parse_name(data, offset)
            if offset + 10 > len(data):
                break
            rtype, rclass, ttl, rdlen = struct.unpack(">HHIH", data[offset:offset + 10])
            offset += 10
            rdata = data[offset:offset + rdlen]
            offset += rdlen

            if rtype == DNS_RECORD_TYPES["A"] and rdlen == 4:
                ip = ".".join(str(b) for b in rdata)
                if rtype not in results:
                    results[rtype] = []
                results[rtype].append(ip)

            elif rtype == DNS_RECORD_TYPES["CNAME"]:
                cname, _ = self._parse_name(data, offset - rdlen)
                if cname:
                    if rtype not in results:
                        results[rtype] = []
                    results[rtype].append(cname + ".")

            elif rtype == DNS_RECORD_TYPES["MX"]:
                if rdlen >= 3:
                    preference = struct.unpack(">H", rdata[:2])[0]
                    mx_name, _ = self._parse_name(data, offset - rdlen + 2)
                    if mx_name:
                        if rtype not in results:
                            results[rtype] = []
                        results[rtype].append(f"{preference} {mx_name}.")

        final_results: Dict[str, List[str]] = {}
        for rtype_num, values in results.items():
            type_name = TYPE_NAMES.get(rtype_num, str(rtype_num))
            final_results[type_name] = sorted(set(values))
        final_results["_status"] = "ok"
        return final_results

    def _send_query(self, query: bytes) -> Optional[bytes]:
        last_error: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.timeout)
            try:
                sock.sendto(query, (self.resolver, 53))
                response, _ = sock.recvfrom(512)
                return response
            except Exception as e:
                last_error = e
            finally:
                sock.close()
        if last_error:
            raise last_error
        return None

    def resolve(self, domain: str, record_type: str) -> Dict[str, Any]:
        record_type = record_type.upper()
        if record_type not in DNS_RECORD_TYPES:
            return {"type": record_type, "values": [], "error": f"Unsupported type: {record_type}"}

        qtype = DNS_RECORD_TYPES[record_type]
        query = self._build_query(domain, qtype)

        try:
            response = self._send_query(query)
            if response is None:
                return {"type": record_type, "values": [], "error": "No response"}

            parsed = self._parse_response(response, qtype)
            values = parsed.get(record_type, [])
            return {"type": record_type, "values": values, "error": None}
        except Exception as e:
            return {"type": record_type, "values": [], "error": str(e)}

    def resolve_zone(
        self, domain: str, record_types: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        results: Dict[str, Dict[str, Any]] = {}
        for rtype in record_types:
            results[rtype] = self.resolve(domain, rtype)
        return results
