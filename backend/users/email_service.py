import logging

import requests
from django.conf import settings


logger = logging.getLogger(__name__)


class BrevoEmailError(Exception):
    """Raised when Brevo cannot send an email."""


def send_brevo_email(
    *,
    recipient_email: str,
    recipient_name: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> dict:
    """
    Send a transactional email through the Brevo HTTPS API.
    """

    if not settings.BREVO_API_KEY:
        raise BrevoEmailError("BREVO_API_KEY is not configured.")

    if not settings.BREVO_SENDER_EMAIL:
        raise BrevoEmailError("BREVO_SENDER_EMAIL is not configured.")

    response = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        },
        json={
            "sender": {
                "name": settings.BREVO_SENDER_NAME,
                "email": settings.BREVO_SENDER_EMAIL,
            },
            "to": [
                {
                    "email": recipient_email,
                    "name": recipient_name or recipient_email,
                }
            ],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": text_content,
        },
        timeout=20,
    )

    if response.status_code not in {200, 201, 202}:
        logger.error(
            "Brevo rejected the email. Status: %s Response: %s",
            response.status_code,
            response.text,
        )

        raise BrevoEmailError(
            "Brevo rejected the email request."
        )

    return response.json()