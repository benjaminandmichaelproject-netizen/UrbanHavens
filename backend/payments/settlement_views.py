from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .serializers import PaymentSerializer
from .paystack import (
    PaystackError,
    find_payment_settlement,
)


class SyncPaymentSettlementView(APIView):
    # Requires an authenticated owner or administrator.
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, payment_id):
        user = request.user
        role = getattr(user, "role", None)

        # Restricts settlement synchronization to owners and admins.
        if not (
            user.is_superuser
            or role in ["owner", "landlord", "admin"]
        ):
            raise PermissionDenied(
                "Only property owners can synchronize settlements."
            )

        try:
            # Loads the payment before contacting Paystack.
            payment = (
                Payment.objects.select_related(
                    "landlord",
                    "property",
                    "booking",
                )
                .get(
                    id=payment_id,
                    status="success",
                    payment_method="paystack",
                )
            )
        except Payment.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Successful Paystack payment not found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevents owners from checking another owner's settlement.
        if not (
            user.is_superuser
            or role == "admin"
            or payment.landlord_id == user.id
        ):
            raise PermissionDenied(
                "You cannot synchronize another owner's settlement."
            )

        # Returns immediately when the settlement is already recorded.
        if payment.settlement_status == "paid":
            return Response(
                {
                    "detail": (
                        "This payment has already been marked "
                        "as settled."
                    ),
                    "payment": PaymentSerializer(payment).data,
                },
                status=status.HTTP_200_OK,
            )

        # Loads the owner's active Paystack subaccount.
        payment_account = getattr(
            payment.landlord,
            "payment_account",
            None,
        )

        if not payment_account:
            return Response(
                {
                    "detail": (
                        "The property owner does not have a "
                        "payment account."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not payment_account.is_active:
            return Response(
                {
                    "detail": (
                        "The owner's payment account is inactive."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        subaccount_code = (
            payment_account.paystack_subaccount_code
        )

        if not subaccount_code:
            return Response(
                {
                    "detail": (
                        "The owner's Paystack subaccount has not "
                        "been configured."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Searches from one day before payment to today.
        payment_date = (
            payment.verified_at
            or payment.created_at
        )

        date_from = (
            payment_date.date() - timedelta(days=1)
        ).isoformat()

        date_to = (
            timezone.localdate() + timedelta(days=1)
        ).isoformat()

        try:
            # Searches Paystack settlements for this exact payment.
            settlement_result = find_payment_settlement(
                payment_reference=str(payment.reference),
                subaccount_code=subaccount_code,
                date_from=date_from,
                date_to=date_to,
            )
        except PaystackError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Keeps the payment pending when Paystack has not settled it yet.
        if not settlement_result:
            return Response(
                {
                    "detail": (
                        "Paystack has not yet returned a completed "
                        "settlement for this payment."
                    ),
                    "settlement_status": (
                        payment.settlement_status
                    ),
                },
                status=status.HTTP_200_OK,
            )

        settlement = settlement_result.get(
            "settlement",
            {},
        )
        settlement_transaction = settlement_result.get(
            "transaction",
            {},
        )

        # Reads the Paystack settlement status safely.
        paystack_status = str(
            settlement.get("status", "")
        ).strip().lower()

        # Accepts only Paystack-completed settlement states.
        paid_statuses = {
            "success",
            "successful",
            "paid",
            "processed",
            "completed",
        }

        if paystack_status not in paid_statuses:
            return Response(
                {
                    "detail": (
                        "Paystack found the settlement, but it has "
                        "not been completed yet."
                    ),
                    "paystack_status": paystack_status or "unknown",
                    "settlement_status": (
                        payment.settlement_status
                    ),
                },
                status=status.HTTP_200_OK,
            )

        # Extracts the settlement date returned by Paystack.
        settled_at_value = (
            settlement.get("settled_at")
            or settlement.get("paid_at")
            or settlement.get("updatedAt")
            or settlement.get("updated_at")
        )

        settled_at = None

        if settled_at_value:
            # Parses Paystack's ISO date into a Django datetime.
            settled_at = parse_datetime(
                str(settled_at_value)
            )

        if settled_at is None:
            # Uses the current time when Paystack omits a usable date.
            settled_at = timezone.now()

        settlement_id = str(
            settlement.get("id", "")
        )

        settlement_reference = str(
            settlement.get("reference")
            or settlement_transaction.get("reference")
            or ""
        )

        # Stores the confirmed settlement inside one locked transaction.
        with transaction.atomic():
            try:
                locked_payment = (
                    Payment.objects.select_for_update()
                    .get(
                        id=payment.id,
                        status="success",
                        payment_method="paystack",
                    )
                )
            except Payment.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "The payment changed before settlement "
                            "synchronization completed."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Avoids overwriting a settlement saved by another request.
            if locked_payment.settlement_status == "paid":
                return Response(
                    {
                        "detail": (
                            "This payment has already been settled."
                        ),
                        "payment": PaymentSerializer(
                            locked_payment
                        ).data,
                    },
                    status=status.HTTP_200_OK,
                )

            # Marks the owner payout as successfully completed.
            locked_payment.settlement_status = "paid"
            locked_payment.settlement_id = settlement_id
            locked_payment.settlement_reference = (
                settlement_reference
            )
            locked_payment.settlement_response = (
                settlement_result
            )
            locked_payment.settled_at = settled_at

            # Saves only the settlement fields being changed.
            locked_payment.save(
                update_fields=[
                    "settlement_status",
                    "settlement_id",
                    "settlement_reference",
                    "settlement_response",
                    "settled_at",
                    "updated_at",
                ]
            )

        return Response(
            {
                "detail": (
                    "Paystack settlement synchronized successfully."
                ),
                "payment": PaymentSerializer(
                    locked_payment
                ).data,
                "paystack_settlement": {
                    "id": settlement_id,
                    "reference": settlement_reference,
                    "status": paystack_status,
                    "settled_at": settled_at,
                },
            },
            status=status.HTTP_200_OK,
        )