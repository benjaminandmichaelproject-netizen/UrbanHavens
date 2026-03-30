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
BMS_SENDER_ID = os.getenv("BMS_SENDER_ID", "Urbanhavens")

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
    problem, validation problem, or a network/HTTP failure.
    """
    pass


# ---------------------------------------------------------------------------
# Phone number normalisation
# ---------------------------------------------------------------------------

def normalize_ghana_phone(phone: str) -> str:
    """
    Normalise a Ghanaian phone number to the format expected by the SMS
    gateway: 233XXXXXXXXX (no leading '+', no spaces, no dashes).

    Supported formats:
        +233XXXXXXXXX  -> 233XXXXXXXXX
        233XXXXXXXXX   -> 233XXXXXXXXX
        0XXXXXXXXX     -> 233XXXXXXXXX
        anything else  -> returned as-is
    """
    phone = (phone or "").strip().replace(" ", "").replace("-", "")

    if phone.startswith("+233"):
        return phone[1:]

    if phone.startswith("233"):
        return phone

    if phone.startswith("0") and len(phone) >= 10:
        return "233" + phone[1:]

    return phone


# ---------------------------------------------------------------------------
# Core send function
# ---------------------------------------------------------------------------

def send_sms(
    phone: str,
    message: str,
    sender_id: Optional[str] = None,
    booking_id: Optional[int] = None,
    meeting_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Send a single SMS message via the configured mNotify gateway and log
    the outcome to the SystemLog table.

    Returns:
        Parsed JSON response from the gateway.

    Raises:
        SMSServiceError: If configuration is missing, inputs are invalid,
        provider rejects the request, or the HTTP request fails.
    """
    from system_logs.logger import log_sms_success, log_sms_failure

    if not BMS_API_KEY:
        err = "BMS_API_KEY is missing from environment variables."
        log_sms_failure(
            message=err,
            phone=phone,
            booking_id=booking_id,
            meeting_id=meeting_id,
            detail=err,
        )
        raise SMSServiceError(err)

    if not phone:
        err = "Phone number is required."
        log_sms_failure(
            message=err,
            phone="",
            booking_id=booking_id,
            meeting_id=meeting_id,
            detail=err,
        )
        raise SMSServiceError(err)

    if not message:
        err = "SMS message is required."
        log_sms_failure(
            message=err,
            phone=phone,
            booking_id=booking_id,
            meeting_id=meeting_id,
            detail=err,
        )
        raise SMSServiceError(err)

    recipient = normalize_ghana_phone(phone)
    final_sender = sender_id or BMS_SENDER_ID

    # Match mNotify docs structure exactly
    payload = {
        "recipient": [recipient],
        "sender": final_sender,
        "message": message,
        "is_schedule": False,
        "schedule_date": "",
    }

    try:
        response = requests.post(
            f"{BMS_SMS_URL}?key={BMS_API_KEY}",
            json=payload,
            timeout=BMS_TIMEOUT,
        )
        response.raise_for_status()

        try:
            result = response.json()
        except ValueError:
            result = {"raw_response": response.text}

        print("\n========== SMS API RESPONSE ==========")
        print("Recipient:", recipient)
        print("Sender:", final_sender)
        print("Message:", message)
        print("Response:", result)
        print("=====================================\n")

        status_value = str(result.get("status", "")).lower()
        code_value = str(result.get("code", ""))
        summary = result.get("summary") or {}
        message_id = summary.get("message_id", "")

        if status_value == "success":
            log_sms_success(
                message=f"SMS accepted by provider for {recipient}",
                phone=recipient,
                booking_id=booking_id,
                meeting_id=meeting_id,
                detail=str(result),
            )
            return result

        error_text = (
            f"SMS provider rejected request. "
            f"status={status_value}, code={code_value}, message={result.get('message', '')}"
        )

        log_sms_failure(
            message=f"SMS provider rejected request for {recipient}",
            phone=recipient,
            booking_id=booking_id,
            meeting_id=meeting_id,
            detail=str(result),
        )
        raise SMSServiceError(error_text)

    except requests.RequestException as exc:
        response_text = ""
        if getattr(exc, "response", None) is not None:
            response_text = exc.response.text

        print("\n========== SMS ERROR ==========")
        print("Recipient:", recipient)
        print("Sender:", final_sender)
        print("Message:", message)
        print("Error:", str(exc))
        if response_text:
            print("Provider Response:", response_text)
        print("================================\n")

        log_sms_failure(
            message=f"SMS failed to {recipient}: {exc}",
            phone=recipient,
            booking_id=booking_id,
            meeting_id=meeting_id,
            detail=response_text or str(exc),
        )
        raise SMSServiceError(f"SMS request failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Booking lifecycle SMS helpers
# ---------------------------------------------------------------------------

def send_booking_created_sms(booking) -> Optional[Dict[str, Any]]:
    """Notify the landlord when a new booking is made on their property."""
    landlord = getattr(booking, "owner", None)
    phone = getattr(landlord, "phone", None)

    if not phone:
        return None

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

    return send_sms(phone, message, booking_id=booking.id)


def send_booking_rejected_sms(booking) -> Optional[Dict[str, Any]]:
    """Notify the tenant when their booking request has been rejected."""
    tenant = getattr(booking, "tenant", None)
    phone = getattr(tenant, "phone", None)

    if not phone:
        return None

    property_name = booking.property.property_name
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: Your booking for {property_name} was rejected. "
        f"View: {property_link}"
    )

    return send_sms(phone, message, booking_id=booking.id)


def send_booking_approved_sms(booking) -> Optional[Dict[str, Any]]:
    """Notify the tenant when their booking request has been approved."""
    tenant = getattr(booking, "tenant", None)
    phone = getattr(tenant, "phone", None)

    if not phone:
        return None

    property_name = booking.property.property_name
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: Your booking for {property_name} was approved! "
        f"View: {property_link}"
    )

    return send_sms(phone, message, booking_id=booking.id)


def send_booking_cancelled_sms(booking) -> Optional[Dict[str, Any]]:
    """Notify the landlord when a tenant cancels an existing booking."""
    landlord = getattr(booking, "owner", None)
    phone = getattr(landlord, "phone", None)

    if not phone:
        return None

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

    return send_sms(phone, message, booking_id=booking.id)


# ---------------------------------------------------------------------------
# Meeting lifecycle SMS helpers
# ---------------------------------------------------------------------------

def send_meeting_scheduled_sms(meeting) -> Optional[Dict[str, Any]]:
    """
    Notify the tenant when an inspection meeting has been scheduled.
    Includes property name, date, time, and location.
    """
    tenant = getattr(meeting.booking, "tenant", None)
    phone = getattr(tenant, "phone", None)

    if not phone:
        return None

    property_name = meeting.booking.property.property_name
    property_link = f"{BASE_URL}/properties/{meeting.booking.property.id}/"
    formatted_date = meeting.date.strftime("%d %b %Y") if meeting.date else "N/A"
    formatted_time = meeting.time.strftime("%H:%M") if meeting.time else "N/A"

    message = (
        f"UrbanHavens: Inspection meeting scheduled for {property_name}. "
        f"Date: {formatted_date}, Time: {formatted_time}, "
        f"Location: {meeting.location}. View: {property_link}"
    )

    return send_sms(
        phone,
        message,
        booking_id=meeting.booking.id,
        meeting_id=meeting.id,
    )


def send_meeting_updated_sms(meeting) -> Optional[Dict[str, Any]]:
    """
    Notify the tenant when an existing inspection meeting has been updated
    with new date, time, or location details.
    """
    tenant = getattr(meeting.booking, "tenant", None)
    phone = getattr(tenant, "phone", None)

    if not phone:
        return None

    property_name = meeting.booking.property.property_name
    property_link = f"{BASE_URL}/properties/{meeting.booking.property.id}/"
    formatted_date = meeting.date.strftime("%d %b %Y") if meeting.date else "N/A"
    formatted_time = meeting.time.strftime("%H:%M") if meeting.time else "N/A"

    message = (
        f"UrbanHavens: Your inspection meeting for {property_name} has been updated. "
        f"New Date: {formatted_date}, Time: {formatted_time}, "
        f"Location: {meeting.location}. View: {property_link}"
    )

    return send_sms(
        phone,
        message,
        booking_id=meeting.booking.id,
        meeting_id=meeting.id,
    )