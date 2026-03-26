import os
import requests
from typing import Any, Dict, Optional


BMS_SMS_URL = os.getenv("BMS_SMS_URL", "https://api.mnotify.com/api/sms/quick")
BMS_API_KEY = os.getenv("BMS_API_KEY")
BMS_SENDER_ID = os.getenv("BMS_SENDER_ID", "UrbanHavens")
BMS_TIMEOUT = int(os.getenv("BMS_TIMEOUT", "20"))


class SMSServiceError(Exception):
    pass


def normalize_ghana_phone(phone: str) -> str:
    phone = (phone or "").strip().replace(" ", "").replace("-", "")

    if phone.startswith("+233"):
        return phone[1:]

    if phone.startswith("233"):
        return phone

    if phone.startswith("0") and len(phone) >= 10:
        return "233" + phone[1:]

    return phone


def _build_headers() -> Dict[str, str]:
    if not BMS_API_KEY:
        raise SMSServiceError("BMS_API_KEY is missing from environment variables.")

    return {
        "Content-Type": "application/json",
    }


def send_sms(phone: str, message: str, sender_id: Optional[str] = None) -> Dict[str, Any]:
    if not phone:
        raise SMSServiceError("Phone number is required.")

    if not message:
        raise SMSServiceError("SMS message is required.")

    recipient = normalize_ghana_phone(phone)

    payload = {
        "recipient": recipient,
        "sender": sender_id or BMS_SENDER_ID,
        "message": message,
        "is_schedule": "false",
        "sms_type": "plain",
        "api_key": BMS_API_KEY,
    }

    try:
        response = requests.post(
            BMS_SMS_URL,
            json=payload,
            headers=_build_headers(),
            timeout=BMS_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise SMSServiceError(f"SMS request failed: {exc}") from exc


def send_booking_created_sms(booking) -> Optional[Dict[str, Any]]:
    landlord = getattr(booking, "owner", None)
    phone = getattr(landlord, "phone", None)

    if not phone:
        return None

    tenant_name = (
        f"{booking.tenant.first_name} {booking.tenant.last_name}".strip()
        or booking.tenant.username
    )

    property_name = booking.property.property_name

    message = (
        f"UrbanHavens: New booking request for {property_name} "
        f"from {tenant_name}. Log in to review."
    )

    return send_sms(phone, message)


def send_booking_rejected_sms(booking) -> Optional[Dict[str, Any]]:
    tenant = getattr(booking, "tenant", None)
    phone = getattr(tenant, "phone", None)

    if not phone:
        return None

    property_name = booking.property.property_name
    message = f"UrbanHavens: Your booking request for {property_name} was rejected."

    return send_sms(phone, message)