#!/usr/bin/env python3
"""SSL certificate & domain expiration inspector -- main entry point.

Usage:
    python inspect.py --config domains.yaml

Implementation note
-------------------
This file is intentionally named ``inspect.py`` to match the project's CLI
contract. That name shadows the standard-library ``inspect`` module on
``sys.path``. Python's own ``dataclasses`` (imported by ``ssl_inspect.config``)
runs ``import inspect`` at import time, so when this file is *imported as a
module* (rather than executed as the main script) we transparently load and
re-export the real standard-library ``inspect``. When executed directly
(``python inspect.py``) we just delegate to :mod:`ssl_inspect.cli`.
"""

import sys

if __name__ == "__main__":
    # Executed directly: run the real application.
    from ssl_inspect.cli import main

    raise SystemExit(main())
else:
    # Imported as the ``inspect`` module by stdlib code (e.g. dataclasses).
    # Re-export the genuine standard-library inspect so dependents keep working.
    import importlib.util as _ilu
    import os as _os
    import sysconfig as _sysconfig

    _candidates = []
    _os_file = getattr(_os, "__file__", None)
    if _os_file:
        _candidates.append(_os.path.join(_os.path.dirname(_os_file), "inspect.py"))
    try:
        _candidates.append(_os.path.join(_sysconfig.get_path("stdlib"), "inspect.py"))
    except Exception:
        pass
    _stdlib_inspect = next(
        (p for p in _candidates if p and _os.path.isfile(p)), None
    )
    if _stdlib_inspect:
        _spec = _ilu.spec_from_file_location("inspect", _stdlib_inspect)
        _real_inspect = _ilu.module_from_spec(_spec)
        sys.modules["inspect"] = _real_inspect
        _spec.loader.exec_module(_real_inspect)
