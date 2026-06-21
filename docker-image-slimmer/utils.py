def format_size(size_bytes):
    if size_bytes < 0:
        return '-' + format_size(-size_bytes)
    if size_bytes < 1024:
        return f'{size_bytes} B'
    elif size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.2f} KB'
    elif size_bytes < 1024 * 1024 * 1024:
        return f'{size_bytes / (1024 * 1024):.2f} MB'
    else:
        return f'{size_bytes / (1024 * 1024 * 1024):.2f} GB'


def parse_dockerfile_instruction(created_by):
    if not created_by:
        return 'UNKNOWN', ''

    if '#(nop)' in created_by:
        nop_part = created_by.split('#(nop)', 1)[1].strip()
        parts = nop_part.split(None, 1)
        if parts:
            instruction = parts[0].upper()
            args = parts[1] if len(parts) > 1 else ''
            return instruction, args
        return 'NOP', nop_part

    if 'RUN' in created_by.upper() or '/bin/sh -c' in created_by:
        cmd = created_by
        if '/bin/sh -c ' in cmd:
            cmd = cmd.split('/bin/sh -c ', 1)[1]
        return 'RUN', cmd.strip()

    return 'UNKNOWN', created_by
