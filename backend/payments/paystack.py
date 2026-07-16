import requests
from django.conf import settings


PAYSTACK_BASE_URL = "https://api.paystack.co"


class PaystackError(Exception):
    pass


def _get_headers():
    secret_key = getattr(settings, "PAYSTACK_SECRET_KEY", "")

    if not secret_key:
        raise PaystackError("Paystack secret key is not configured.")

    return {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }


def _read_json_response(response):
    try:
        return response.json()
    except ValueError as exc:
        raise PaystackError(
            "Paystack returned an invalid response."
        ) from exc


def list_ghana_mobile_money_providers():
    """
    Fetch Paystack-supported Ghana mobile-money providers.

    Paystack requires the provider's official code when creating
    a subaccount. We fetch the codes instead of hard-coding them.
    """
    try:
        response = requests.get(
            f"{PAYSTACK_BASE_URL}/bank",
            params={
                "country": "ghana",
                "currency": "GHS",
                "type": "mobile_money",
                "perPage": 100,
            },
            headers=_get_headers(),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise PaystackError(
            "Could not connect to Paystack to load payment providers."
        ) from exc

    data = _read_json_response(response)

    if response.status_code != 200 or not data.get("status"):
        raise PaystackError(
            data.get(
                "message",
                "Could not load Ghana mobile-money providers.",
            )
        )

    return data.get("data", [])


def resolve_ghana_mobile_money_code(provider):
    """
    Convert UrbanHavens provider values into the current official
    Paystack provider code.
    """
    normalized_provider = str(provider or "").strip().lower()

    aliases = {
        "mtn": ("mtn", "mobile money"),
        "telecel": ("telecel", "vodafone"),
        "airteltigo": ("airteltigo", "airtel", "tigo"),
    }

    search_terms = aliases.get(normalized_provider)

    if not search_terms:
        raise PaystackError(
            "Only MTN, Telecel and AirtelTigo mobile-money accounts "
            "are currently supported."
        )

    providers = list_ghana_mobile_money_providers()

    for item in providers:
        searchable_text = " ".join(
            [
                str(item.get("name", "")),
                str(item.get("slug", "")),
                str(item.get("code", "")),
            ]
        ).lower()

        if any(term in searchable_text for term in search_terms):
            code = item.get("code")

            if code:
                return str(code)

    raise PaystackError(
        "The selected mobile-money provider is not currently available "
        "on Paystack."
    )


def create_paystack_subaccount(
    *,
    business_name,
    bank_code,
    account_number,
    percentage_charge,
    contact_email="",
    contact_phone="",
):
    payload = {
        "business_name": business_name,
        "bank_code": bank_code,
        "account_number": account_number,
        "percentage_charge": float(percentage_charge),
    }

    if contact_email:
        payload["primary_contact_email"] = contact_email

    if contact_phone:
        payload["primary_contact_phone"] = contact_phone

    try:
        response = requests.post(
            f"{PAYSTACK_BASE_URL}/subaccount",
            json=payload,
            headers=_get_headers(),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise PaystackError(
            "Could not connect to Paystack to create the owner subaccount."
        ) from exc

    data = _read_json_response(response)

    if response.status_code not in (200, 201) or not data.get("status"):
        raise PaystackError(
            data.get(
                "message",
                "Paystack subaccount creation failed.",
            )
        )

    return data["data"]


def initialize_paystack_payment(
    *,
    email,
    amount,
    reference,
    callback_url,
    subaccount_code=None,
    bearer="subaccount",
):
    payload = {
        "email": email,
        "amount": int(amount * 100),
        "reference": str(reference),
        "callback_url": callback_url,
        "currency": "GHS",
    }

    if subaccount_code:
        payload["subaccount"] = subaccount_code
        payload["bearer"] = bearer

    try:
        response = requests.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            json=payload,
            headers=_get_headers(),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise PaystackError(
            "Could not connect to Paystack."
        ) from exc

    data = _read_json_response(response)

    if response.status_code != 200 or not data.get("status"):
        raise PaystackError(
            data.get(
                "message",
                "Paystack initialization failed.",
            )
        )

    return data["data"]


def verify_paystack_payment(reference):
    try:
        response = requests.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=_get_headers(),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise PaystackError(
            "Could not connect to Paystack."
        ) from exc

    data = _read_json_response(response)

    if response.status_code != 200 or not data.get("status"):
        raise PaystackError(
            data.get(
                "message",
                "Paystack verification failed.",
            )
        )

    return data["data"]



def list_paystack_settlements(
    *,
    subaccount_code=None,
    date_from=None,
    date_to=None,
    per_page=50,
):
    """
    Fetch settlements from Paystack.

    When a subaccount code is supplied, only settlements for that
    landlord subaccount are returned.
    """
    params = {
        "perPage": per_page,
    }

    if subaccount_code:
        params["subaccount"] = subaccount_code

    if date_from:
        params["from"] = date_from

    if date_to:
        params["to"] = date_to

    try:
        response = requests.get(
            f"{PAYSTACK_BASE_URL}/settlement",
            params=params,
            headers=_get_headers(),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise PaystackError(
            "Could not connect to Paystack to load settlements."
        ) from exc

    data = _read_json_response(response)

    if response.status_code != 200 or not data.get("status"):
        raise PaystackError(
            data.get(
                "message",
                "Could not load Paystack settlements.",
            )
        )

    return data.get("data", [])


def list_paystack_settlement_transactions(
    settlement_id,
    *,
    page=1,
    per_page=100,
):
    """
    Fetch transactions included in one Paystack settlement.
    """
    if not settlement_id:
        raise PaystackError(
            "A settlement ID is required."
        )

    try:
        response = requests.get(
            (
                f"{PAYSTACK_BASE_URL}/settlement/"
                f"{settlement_id}/transactions"
            ),
            params={
                "page": page,
                "perPage": per_page,
            },
            headers=_get_headers(),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise PaystackError(
            "Could not connect to Paystack to load settlement transactions."
        ) from exc

    data = _read_json_response(response)

    if response.status_code != 200 or not data.get("status"):
        raise PaystackError(
            data.get(
                "message",
                "Could not load settlement transactions.",
            )
        )

    return data.get("data", [])
def find_payment_settlement(
    *,
    payment_reference,
    subaccount_code=None,
    date_from=None,
    date_to=None,
):
    """
    Finds the Paystack settlement containing one payment.

    The settlement list is not filtered with the stored ACCT code
    because Paystack's settlement filter expects a subaccount ID.
    """
    if not payment_reference:
        raise PaystackError(
            "A payment reference is required."
        )

    # Loads integration settlements without using the ACCT code as an ID.
    settlements = list_paystack_settlements(
        date_from=date_from,
        date_to=date_to,
        per_page=100,
    )

    for settlement in settlements:
        settlement_id = settlement.get("id")

        if not settlement_id:
            continue

        # Loads transactions included in this settlement.
        transactions = list_paystack_settlement_transactions(
            settlement_id,
            page=1,
            per_page=100,
        )

        for transaction in transactions:
            transaction_reference = str(
                transaction.get("reference", "")
            ).strip()

            # Matches the exact UrbanHavens payment reference.
            if transaction_reference != str(
                payment_reference
            ).strip():
                continue

            # Confirms the transaction belongs to the expected subaccount.
            transaction_subaccount = (
                transaction.get("subaccount")
                or {}
            )

            returned_code = str(
                transaction_subaccount.get(
                    "subaccount_code",
                    "",
                )
                or transaction_subaccount.get(
                    "code",
                    "",
                )
            ).strip()

            if (
                subaccount_code
                and returned_code
                and returned_code != str(
                    subaccount_code
                ).strip()
            ):
                continue

            return {
                "settlement": settlement,
                "transaction": transaction,
            }

    return None