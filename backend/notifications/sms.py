import os
import requests
from typing import Any, Dict, Optional


BMS_SMS_URL = os.getenv("BMS_SMS_URL", "https://api.mnotify.com/api/sms/quick")
BMS_API_KEY = os.getenv("BMS_API_KEY")
BMS_SENDER_ID = os.getenv("BMS_SENDER_ID", "UrbanHavens")
BMS_TIMEOUT = int(os.getenv("BMS_TIMEOUT", "20"))
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")


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


def send_sms(phone: str, message: str, sender_id: Optional[str] = None) -> Dict[str, Any]:
    if not BMS_API_KEY:
        raise SMSServiceError("BMS_API_KEY is missing from environment variables.")

    if not phone:
        raise SMSServiceError("Phone number is required.")

    if not message:
        raise SMSServiceError("SMS message is required.")

    recipient = normalize_ghana_phone(phone)

    params = {
        "key": BMS_API_KEY,
    }

    payload = {
        "recipient[]": recipient,
        "sender": sender_id or BMS_SENDER_ID,
        "message": message,
        "is_schedule": "false",
        "schedule_date": "",
    }

    try:
        response = requests.post(
            BMS_SMS_URL,
            params=params,
            data=payload,
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
    property_link = f"{BASE_URL}/properties/{booking.property.id}/"

    message = (
        f"UrbanHavens: New booking for {property_name} "
        f"from {tenant_name}. View: {property_link}"
    )

    return send_sms(phone, message)


def send_booking_rejected_sms(booking) -> Optional[Dict[str, Any]]:
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

    return send_sms(phone, message)


def send_booking_approved_sms(booking) -> Optional[Dict[str, Any]]:
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

    return send_sms(phone, message)


def send_booking_cancelled_sms(booking) -> Optional[Dict[str, Any]]:
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

    return send_sms(phone, message)