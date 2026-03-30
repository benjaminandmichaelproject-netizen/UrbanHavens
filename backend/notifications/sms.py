import os
import requests
from typing import Any, Dict, Optional


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# SMS gateway endpoint; defaults to mNotify's quick-send API
BMS_SMS_URL = os.getenv("BMS_SMS_URL", "https://api.mnotify.com/api/sms/quick")

# API key for authenticating with the SMS provider — must be set in the
# environment before any SMS can be sent
BMS_API_KEY = os.getenv("BMS_API_KEY")

# Sender ID displayed to the recipient; defaults to the platform brand name
BMS_SENDER_ID = os.getenv("BMS_SENDER_ID", "UrbanHavens")

# Maximum seconds to wait for the SMS API to respond before timing out
BMS_TIMEOUT = int(os.getenv("BMS_TIMEOUT", "20"))

# Base URL of the application, used to build property deep-links in messages
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class SMSServiceError(Exception):
    """
    Raised when an SMS cannot be sent, either because of a configuration
    problem (missing API key, empty recipient) or a network/HTTP failure.

    Callers should catch this exception and decide whether to propagate it
    or silently log it, depending on whether SMS delivery is critical to
    the operation in progress.
    """
    pass


# ---------------------------------------------------------------------------
# Phone number normalisation
# ---------------------------------------------------------------------------

def normalize_ghana_phone(phone: str) -> str:
    """
    Normalise a Ghanaian phone number to the format expected by the SMS
    gateway: ``233XXXXXXXXX`` (no leading '+', no spaces, no dashes).

    Supported input formats and their transformations:

    +-----------------------+-------------------+
    | Input                 | Output            |
    +=======================+===================+
    | +233XXXXXXXXX         | 233XXXXXXXXX      |
    | 233XXXXXXXXX          | 233XXXXXXXXX      |
    | 0XXXXXXXXX (≥10 chars)| 233XXXXXXXXX      |
    | anything else         | returned as-is    |
    +-----------------------+-------------------+

    Numbers in an unrecognised format are returned unchanged and left for
    the SMS gateway to validate or reject.

    Args:
        phone: Raw phone number string from the database or user input.

    Returns:
        Cleaned and normalised phone number string.
    """
    # Strip surrounding whitespace, internal spaces, and dashes to produce
    # a plain digit string we can inspect reliably
    phone = (phone or "").strip().replace(" ", "").replace("-", "")

    if phone.startswith("+233"):
        # International format with explicit '+' — drop the '+' only
        return phone[1:]

    if phone.startswith("233"):
        # Already in the correct gateway format — pass through unchanged
        return phone

    if phone.startswith("0") and len(phone) >= 10:
        # Local Ghanaian format (e.g. 0244123456) — replace leading '0'
        # with the country code '233'
        return "233" + phone[1:]

    # Unrecognised format — return as-is and let the gateway handle it
    return phone


# ---------------------------------------------------------------------------
# Core send function
# ---------------------------------------------------------------------------

def send_sms(
    phone: str,
    message: str,
    sender_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send a single SMS message via the configured mNotify gateway.

    The phone number is normalised to the Ghana international format before
    the request is made.  The API key is passed as a query parameter and the
    payload is sent as form-encoded data (as required by mNotify).

    Args:
        phone:      Recipient's phone number in any supported Ghana format.
        message:    Text body of the SMS (keep under 160 chars for single SMS).
        sender_id:  Override the default sender name shown to the recipient.
                    Falls back to the ``BMS_SENDER_ID`` environment variable.

    Returns:
        Parsed JSON response from the gateway as a dictionary.

    Raises:
        SMSServiceError: If ``BMS_API_KEY`` is not set, either required
                         argument is empty, or the HTTP request fails.
    """

    # --- Pre-flight checks ------------------------------------------------

    if not BMS_API_KEY:
        raise SMSServiceError("BMS_API_KEY is missing from environment variables.")

    if not phone:
        raise SMSServiceError("Phone number is required.")

    if not message:
        raise SMSServiceError("SMS message is required.")

    # Normalise the phone number to the format the gateway expects
    recipient = normalize_ghana_phone(phone)

    # --- Build the request ------------------------------------------------

    # The API key is supplied as a URL query parameter for authentication
    params = {
        "key": BMS_API_KEY,
    }

    # mNotify uses 'recipient[]' to support bulk sends in a single request;
    # we always send to exactly one recipient here
    payload = {
        "recipient[]":  recipient,
        "sender":       sender_id or BMS_SENDER_ID,
        "message":      message,
        "is_schedule":  "false",  # Send immediately, not as a scheduled message
        "schedule_date": "",      # Required by the API even for instant sends
    }

    # --- Send and return --------------------------------------------------

    try:
        response = requests.post(
            BMS_SMS_URL,
            params=params,
            data=payload,
            timeout=BMS_TIMEOUT,
        )
        # Raise an HTTPError for any 4xx or 5xx response before parsing JSON
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        # Wrap all requests-level exceptions in our domain error so callers
        # only need to handle one exception type
        raise SMSServiceError(f"SMS request failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Booking lifecycle SMS helpers
# ---------------------------------------------------------------------------

def send_booking_created_sms(booking) -> Optional[Dict[str, Any]]:
    """
    Notify the **landlord** when a new booking is made on their property.

    The message includes the tenant's display name and a direct link to
    the property listing so the landlord can act immediately.

    Args:
        booking: Booking model instance with the following attributes:
                 - ``booking.owner``    — landlord User (must have ``phone``)
                 - ``booking.tenant``   — tenant User (first_name, last_name, username)
                 - ``booking.property`` — Property (property_name, id)

    Returns:
        Gateway response dict on success, or ``None`` if the landlord has
        no phone number on record (silent no-op).
    """
    landlord = getattr(booking, "owner", None)
    phone    = getattr(landlord, "phone", None)

    # Nothing to do if the landlord has no registered phone number
    if not phone:
        return None

    # Prefer the full name; fall back to username when names are not set
    tenant_name = (
        f"{booking.tenant.first_name} {booking.tenant.last_name}".strip()
        or booking.tenant.username
    )

    property_name = booking.property.property_name
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: New booking for {property_name} "
        f"from {tenant_name}. View: {property_link}"
    )

    return send_sms(phone, message)


def send_booking_rejected_sms(booking) -> Optional[Dict[str, Any]]:
    """
    Notify the **tenant** when their booking request has been rejected.

    The message includes a link to the property so the tenant can review
    it or explore alternatives.

    Args:
        booking: Booking model instance with the following attributes:
                 - ``booking.tenant``   — tenant User (must have ``phone``)
                 - ``booking.property`` — Property (property_name, id)

    Returns:
        Gateway response dict on success, or ``None`` if the tenant has
        no phone number on record (silent no-op).
    """
    tenant = getattr(booking, "tenant", None)
    phone  = getattr(tenant, "phone", None)

    # Nothing to do if the tenant has no registered phone number
    if not phone:
        return None

    property_name = booking.property.property_name
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: Your booking for {property_name} was rejected. "
        f"View: {property_link}"
    )

    return send_sms(phone, message)


def send_booking_approved_sms(booking) -> Optional[Dict[str, Any]]:
    """
    Notify the **tenant** when their booking request has been approved.

    Args:
        booking: Booking model instance with the following attributes:
                 - ``booking.tenant``   — tenant User (must have ``phone``)
                 - ``booking.property`` — Property (property_name, id)

    Returns:
        Gateway response dict on success, or ``None`` if the tenant has
        no phone number on record (silent no-op).
    """
    tenant = getattr(booking, "tenant", None)
    phone  = getattr(tenant, "phone", None)

    # Nothing to do if the tenant has no registered phone number
    if not phone:
        return None

    property_name = booking.property.property_name
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: Your booking for {property_name} was approved! "
        f"View: {property_link}"
    )

    return send_sms(phone, message)


def send_meeting_scheduled_sms(meeting) -> Optional[Dict[str, Any]]:
    """
    Notify the **tenant** when an inspection meeting has been scheduled
    for their booking.

    The message includes the property name, meeting date, time, and
    location so the tenant has everything they need in one SMS.

    Args:
        meeting: InspectionMeeting model instance with the following:
                 - ``meeting.booking.tenant`` — tenant User (must have ``phone``)
                 - ``meeting.booking.property`` — Property (property_name, id)
                 - ``meeting.date``     — scheduled meeting date
                 - ``meeting.time``     — scheduled meeting time
                 - ``meeting.location`` — meeting location

    Returns:
        Gateway response dict on success, or ``None`` if the tenant has
        no phone number on record (silent no-op).
    """
    tenant = getattr(meeting.booking, "tenant", None)
    phone  = getattr(tenant, "phone", None)

    # Nothing to do if the tenant has no registered phone number
    if not phone:
        return None

    property_name = meeting.booking.property.property_name
    property_link = f"{BASE_URL}/properties/{meeting.booking.property.id}/"

    # Format date as "31 Mar 2026" and time as "08:20"
    formatted_date = meeting.date.strftime("%d %b %Y") if meeting.date else "N/A"
    formatted_time = meeting.time.strftime("%H:%M") if meeting.time else "N/A"

    message = (
        f"UrbanHavens: Inspection meeting scheduled for {property_name}. "
        f"Date: {formatted_date}, Time: {formatted_time}, "
        f"Location: {meeting.location}. View: {property_link}"
    )

    return send_sms(phone, message)


def send_meeting_updated_sms(meeting) -> Optional[Dict[str, Any]]:
    """
    Notify the **tenant** when an existing inspection meeting has been
    updated with new date, time, or location details.

    Args:
        meeting: InspectionMeeting model instance (same attributes as
                 ``send_meeting_scheduled_sms``).

    Returns:
        Gateway response dict on success, or ``None`` if the tenant has
        no phone number on record (silent no-op).
    """
    tenant = getattr(meeting.booking, "tenant", None)
    phone  = getattr(tenant, "phone", None)

    # Nothing to do if the tenant has no registered phone number
    if not phone:
        return None

    property_name = meeting.booking.property.property_name
    property_link = f"{BASE_URL}/properties/{meeting.booking.property.id}/"

    # Format date as "31 Mar 2026" and time as "08:20"
    formatted_date = meeting.date.strftime("%d %b %Y") if meeting.date else "N/A"
    formatted_time = meeting.time.strftime("%H:%M") if meeting.time else "N/A"

    message = (
        f"UrbanHavens: Your inspection meeting for {property_name} has been updated. "
        f"New Date: {formatted_date}, Time: {formatted_time}, "
        f"Location: {meeting.location}. View: {property_link}"
    )

    return send_sms(phone, message)


def send_booking_cancelled_sms(booking) -> Optional[Dict[str, Any]]:
    """
    Notify the **landlord** when a tenant cancels an existing booking.

    The message includes the tenant's display name so the landlord knows
    who cancelled, and a link to the property listing.

    Args:
        booking: Booking model instance with the following attributes:
                 - ``booking.owner``    — landlord User (must have ``phone``)
                 - ``booking.tenant``   — tenant User (first_name, last_name, username)
                 - ``booking.property`` — Property (property_name, id)

    Returns:
        Gateway response dict on success, or ``None`` if the landlord has
        no phone number on record (silent no-op).
    """
    landlord = getattr(booking, "owner", None)
    phone    = getattr(landlord, "phone", None)

    # Nothing to do if the landlord has no registered phone number
    if not phone:
        return None

    # Prefer the full name; fall back to username when names are not set
    tenant_name = (
        f"{booking.tenant.first_name} {booking.tenant.last_name}".strip()
        or booking.tenant.username
    )

    property_name = booking.property.property_name
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: Booking for {property_name} "
        f"cancelled by {tenant_name}. View: {property_link}"
    )

    return send_sms(phone, message)