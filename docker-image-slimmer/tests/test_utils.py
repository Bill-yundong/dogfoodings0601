import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import format_size, parse_dockerfile_instruction


class TestFormatSize:
    def test_zero_bytes(self):
        assert format_size(0) == '0 B'

    def test_less_than_1kb(self):
        assert format_size(1) == '1 B'
        assert format_size(512) == '512 B'
        assert format_size(1023) == '1023 B'

    def test_exactly_1kb(self):
        assert format_size(1024) == '1.00 KB'

    def test_kilobytes(self):
        assert format_size(1536) == '1.50 KB'
        assert format_size(1024 * 1023) == '1023.00 KB'

    def test_exactly_1mb(self):
        assert format_size(1024 * 1024) == '1.00 MB'

    def test_megabytes(self):
        assert format_size(1024 * 1024 * 5) == '5.00 MB'

    def test_exactly_1gb(self):
        assert format_size(1024 * 1024 * 1024) == '1.00 GB'

    def test_gigabytes(self):
        assert format_size(1024 * 1024 * 1024 * 2) == '2.00 GB'

    def test_negative_value(self):
        assert format_size(-1) == '-1 B'
        assert format_size(-1024) == '-1.00 KB'
        assert format_size(-1024 * 1024) == '-1.00 MB'

    def test_large_negative_value(self):
        assert format_size(-1024 * 1024 * 1024) == '-1.00 GB'


class TestParseDockerfileInstruction:
    def test_nop_copy_instruction(self):
        created_by = '/bin/sh -c #(nop) COPY dir:source in /app'
        instr, args = parse_dockerfile_instruction(created_by)
        assert instr == 'COPY'
        assert 'dir:source in /app' in args

    def test_nop_env_instruction(self):
        created_by = '/bin/sh -c #(nop) ENV NODE_VERSION=18.17.0'
        instr, args = parse_dockerfile_instruction(created_by)
        assert instr == 'ENV'
        assert 'NODE_VERSION=18.17.0' in args

    def test_run_instruction(self):
        created_by = '/bin/sh -c apt-get update'
        instr, args = parse_dockerfile_instruction(created_by)
        assert instr == 'RUN'
        assert args == 'apt-get update'

    def test_run_without_bin_sh(self):
        created_by = 'RUN pip install -r requirements.txt'
        instr, args = parse_dockerfile_instruction(created_by)
        assert instr == 'RUN'
        assert args == 'pip install -r requirements.txt'

    def test_empty_created_by(self):
        instr, args = parse_dockerfile_instruction('')
        assert instr == 'UNKNOWN'
        assert args == ''

    def test_none_created_by(self):
        instr, args = parse_dockerfile_instruction(None)
        assert instr == 'UNKNOWN'
        assert args == ''
