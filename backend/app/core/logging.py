"""Structured JSON logging through one logger. Never logs bodies, passwords or tokens (NFR-217)."""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

LOGGER_NAME = "devdash.api"
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_EXTRA_FIELDS = (
    "requestId",
    "method",
    "path",
    "status",
    "durationMs",
    "userId",
    "errorType",
    "fingerprint",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat().replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
        }
        for name in _EXTRA_FIELDS:
            value = getattr(record, name, None)
            if value is not None:
                payload[name] = value
        return json.dumps(payload)


def configure_logging(level: str) -> logging.Logger:
    logger = logging.getLogger(LOGGER_NAME)
    logger.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(level.upper())
    logger.propagate = False
    return logger
