"""Disk usage collection module.

Detects real filesystem mount points across platforms and appends a
time-series sample of each partition's usage to the CSV store.
"""

import csv
import os
import shutil
import subprocess
from datetime import datetime

import config


def get_mountpoints():
    """Return a list of (device, mountpoint, fstype) for real data partitions."""
    mountpoints = []

    if os.path.exists("/proc/mounts"):
        with open("/proc/mounts", "r") as fh:
            for line in fh:
                parts = line.split()
                if len(parts) < 3:
                    continue
                device, mountpoint, fstype = parts[0], parts[1], parts[2]
                if fstype in config.REAL_FSTYPES:
                    mountpoints.append((device, mountpoint, fstype))
        return mountpoints

    try:
        output = subprocess.check_output(["mount"], text=True, stderr=subprocess.DEVNULL)
    except (subprocess.SubprocessError, OSError):
        output = ""

    for line in output.splitlines():
        if " on " not in line or " (" not in line:
            continue
        try:
            device, rest = line.split(" on ", 1)
            mountpoint, fstype_part = rest.split(" (", 1)
            fstype = fstype_part.split(",")[0].strip().lower()
        except ValueError:
            continue
        device = device.strip()
        mountpoint = mountpoint.strip()
        if fstype in config.REAL_FSTYPES:
            mountpoints.append((device, mountpoint, fstype))

    if not mountpoints:
        mountpoints.append(("/", "/", "unknown"))

    return mountpoints


def sample_disk_usage():
    """Collect one snapshot of disk usage for every detected mount point."""
    samples = []
    timestamp = datetime.now().isoformat(timespec="seconds")
    for device, mountpoint, fstype in get_mountpoints():
        try:
            usage = shutil.disk_usage(mountpoint)
        except (OSError, PermissionError):
            continue
        total = usage.total
        used = usage.used
        free = usage.free
        percent = (used / total * 100.0) if total else 0.0
        samples.append({
            "timestamp": timestamp,
            "mountpoint": mountpoint,
            "device": device,
            "fstype": fstype,
            "total": total,
            "used": used,
            "free": free,
            "usage_percent": round(percent, 2),
        })
    return samples


def collect_once():
    """Collect a single snapshot and append it to the CSV store."""
    os.makedirs(config.DATA_DIR, exist_ok=True)
    samples = sample_disk_usage()
    file_exists = os.path.exists(config.CSV_PATH) and os.path.getsize(config.CSV_PATH) > 0
    with open(config.CSV_PATH, "a", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=config.CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        for sample in samples:
            writer.writerow(sample)
    return samples
