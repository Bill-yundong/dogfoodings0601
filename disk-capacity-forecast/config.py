"""Central configuration for the disk capacity forecast project."""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CSV_PATH = os.path.join(DATA_DIR, "disk_usage.csv")
REPORT_PATH = os.path.join(DATA_DIR, "capacity_report.json")

CSV_FIELDS = [
    "timestamp",
    "mountpoint",
    "device",
    "fstype",
    "total",
    "used",
    "free",
    "usage_percent",
]

REAL_FSTYPES = {
    "ext2", "ext3", "ext4", "xfs", "btrfs", "reiserfs", "jfs", "zfs",
    "apfs", "hfs", "hfsplus", "ntfs", "vfat", "exfat", "fuse.sshfs",
    "nfs", "nfs4", "cifs", "smbfs", "fuse.glusterfs", "overlay",
}

WARN_CRITICAL_PERCENT = 90.0
WARN_WARNING_PERCENT = 80.0

CRITICAL_DAYS = 7
WARNING_DAYS = 30

MIN_SAMPLES_FOR_PREDICTION = 3

GB = 1024 ** 3
