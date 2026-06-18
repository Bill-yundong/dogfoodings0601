import logging
import sys
from logging.handlers import QueueHandler, QueueListener

from config import LOG_FORMAT, LOG_LEVEL

_queue_listener = None


def _get_console_handler():
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(LOG_FORMAT)
    handler.setFormatter(formatter)
    return handler


def setup_main_process_logger(log_queue):
    global _queue_listener
    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL))
    root.handlers.clear()

    console_handler = _get_console_handler()
    root.addHandler(console_handler)

    _queue_listener = QueueListener(log_queue, console_handler)
    _queue_listener.start()

    root.info("Main process logger initialized")
    return root


def setup_worker_logger(log_queue):
    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL))
    root.handlers.clear()
    queue_handler = QueueHandler(log_queue)
    root.addHandler(queue_handler)
    return root


def stop_logger():
    global _queue_listener
    if _queue_listener:
        _queue_listener.stop()
        _queue_listener = None


def get_logger(name=None):
    return logging.getLogger(name)
