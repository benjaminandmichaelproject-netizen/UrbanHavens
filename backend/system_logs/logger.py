"""
system_logs/logger.py

Thin helper functions for writing SystemLog records from anywhere in the
codebase. Import the specific helper you need rather than the model
directly so that log writes are consistent and never crash the caller.
"""

from django.db import OperationalError, DatabaseError


def _write(category, status, message, detail="", **kwargs):
    """
    Internal: write a single SystemLog row, swallowing DB errors so
    that a logging failure never crashes the operation being logged.
    """
    try:
        # Late import to avoid circular imports at module load time
        from .models import SystemLog

        SystemLog.objects.create(
            category=category,
            status=status,
            message=message,
            detail=detail,
            **kwargs,
        )

    except OperationalError as exc:
        # Most common case in local SQLite dev: DB is temporarily locked.
        print(f"[SystemLog] Skipped log write because database is locked: {message} | {exc}")

    except DatabaseError as exc:
        # Any other database-level issue should still not break the caller.
        print(f"[SystemLog] Database error while writing log: {message} | {exc}")

    except Exception as exc:
        # Last-resort fallback for non-database errors.
        print(f"[SystemLog] Failed to write log: {message} | {exc}")


# ---------------------------------------------------------------------------
# SMS helpers
# ---------------------------------------------------------------------------

def log_sms_success(message, phone="", booking_id=None, meeting_id=None, detail=""):
    _write(
        category="sms",
        status="success",
        message=message,
        detail=detail,
        phone=phone,
        booking_id=booking_id,
        meeting_id=meeting_id,
    )


def log_sms_failure(message, phone="", booking_id=None, meeting_id=None, detail=""):
    _write(
        category="sms",
        status="failure",
        message=message,
        detail=detail,
        phone=phone,
        booking_id=booking_id,
        meeting_id=meeting_id,
    )


# ---------------------------------------------------------------------------
# API error helpers
# ---------------------------------------------------------------------------

def log_api_error(message, endpoint="", status_code=None, user=None, detail=""):
    _write(
        category="api_error",
        status="failure",
        message=message,
        detail=detail,
        endpoint=endpoint,
        status_code=status_code,
        user=user,
    )


# ---------------------------------------------------------------------------
# Booking helpers
# ---------------------------------------------------------------------------

def log_booking_event(message, status="info", booking_id=None, user=None, detail=""):
    _write(
        category="booking",
        status=status,
        message=message,
        detail=detail,
        booking_id=booking_id,
        user=user,
    )


# ---------------------------------------------------------------------------
# Meeting helpers
# ---------------------------------------------------------------------------

def log_meeting_event(message, status="info", meeting_id=None, booking_id=None, user=None, detail=""):
    _write(
        category="meeting",
        status=status,
        message=message,
        detail=detail,
        meeting_id=meeting_id,
        booking_id=booking_id,
        user=user,
    )


# ---------------------------------------------------------------------------
# Property helpers
# ---------------------------------------------------------------------------

def log_property_event(message, status="info", property_id=None, user=None, detail="", endpoint=""):
    _write(
        category="property",
        status=status,
        message=message,
        detail=detail,
        property_id=property_id,
        user=user,
        endpoint=endpoint,
    )


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

def log_notification(message, status="success", user=None, detail=""):
    _write(
        category="notification",
        status=status,
        message=message,
        detail=detail,
        user=user,
    )