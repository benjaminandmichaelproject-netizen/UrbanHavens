import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from rest_framework import (
    permissions,
    serializers,
    status,
)
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from leases.models import LeaseRenewalRequest
from notifications.utils import send_notification

from .models import (
    OwnerPaymentAccount,
    Payment,
)
from .paystack import (
    PaystackError,
    initialize_paystack_payment,
    verify_paystack_payment,
)
from .serializers import PaymentSerializer


class InitializeRenewalPaymentSerializer(serializers.Serializer):
    # Identifies the approved renewal request.
    renewal_request_id = serializers.IntegerField(min_value=1)

    # Restricts renewal payments to supported channels.
    payment_method = serializers.ChoiceField(
        choices=["paystack", "direct"],
    )

    # Validates tenant ownership and renewal readiness.
    def validate(self, attrs):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                {"detail": "Authentication is required to initialize renewal payment."}
            )

        try:
            renewal = (
                LeaseRenewalRequest.objects
                .select_related(
                    "current_lease",
                    "tenant",
                    "landlord",
                    "property",
                    "room",
                )
                .get(
                    id=attrs["renewal_request_id"],
                    tenant=request.user,
                )
            )
        except LeaseRenewalRequest.DoesNotExist:
            raise serializers.ValidationError(
                {
                    "renewal_request_id": (
                        "Renewal request not found or does not belong to you."
                    )
                }
            )

        if renewal.status != "payment_pending":
            raise serializers.ValidationError(
                {
                    "renewal_request_id": (
                        "This renewal request is not awaiting payment."
                    )
                }
            )

        if renewal.current_lease.status != "active":
            raise serializers.ValidationError(
                {
                    "renewal_request_id": (
                        "The current lease is no longer active."
                    )
                }
            )

        if (
            renewal.expected_amount is None
            or renewal.expected_amount <= Decimal("0.00")
        ):
            raise serializers.ValidationError(
                {"renewal_request_id": "The renewal amount is invalid."}
            )

        # Passes the trusted renewal to the view.
        attrs["_resolved_renewal"] = renewal
        return attrs


class ConfirmDirectRenewalPaymentSerializer(serializers.Serializer):
    # Stores the amount the owner actually received.
    amount_received = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )

    # Stores an optional owner confirmation note.
    confirmation_note = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=1000,
    )


class InitializeRenewalPaymentView(APIView):
    # Requires the tenant to be authenticated.
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InitializeRenewalPaymentSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        renewal = serializer.validated_data["_resolved_renewal"]
        requested_method = serializer.validated_data["payment_method"]

        payment = None
        created_new_payment = False

        with transaction.atomic():
            # Locks the renewal against simultaneous payment attempts.
            locked_renewal = (
                LeaseRenewalRequest.objects
                .select_for_update()
                .select_related(
                    "current_lease",
                    "tenant",
                    "landlord",
                    "property",
                    "room",
                )
                .get(id=renewal.id, tenant=request.user)
            )

            if locked_renewal.status != "payment_pending":
                return Response(
                    {"detail": "This renewal request is no longer awaiting payment."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if locked_renewal.current_lease.status != "active":
                return Response(
                    {"detail": "The current lease is no longer active."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_payment = (
                Payment.objects
                .select_for_update()
                .filter(renewal_request=locked_renewal)
                .order_by("-created_at")
                .first()
            )

            if existing_payment:
                # Successful payments always block another attempt.
                if existing_payment.status == "success":
                    return Response(
                        {
                            "detail": "This renewal payment has already been completed.",
                            "payment": PaymentSerializer(existing_payment).data,
                            "renewal_status": locked_renewal.status,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # A pending direct payment must wait for owner confirmation.
                if (
                    existing_payment.status == "pending"
                    and existing_payment.payment_method == "direct"
                ):
                    return Response(
                        {
                            "detail": (
                                "A direct renewal payment request already exists "
                                "and is awaiting owner confirmation."
                            ),
                            "payment": PaymentSerializer(existing_payment).data,
                            "renewal_status": locked_renewal.status,
                            "authorization_url": None,
                        },
                        status=status.HTTP_200_OK,
                    )

                # Reuses an existing unfinished Paystack checkout.
                if (
                    existing_payment.status == "pending"
                    and existing_payment.payment_method == "paystack"
                    and existing_payment.paystack_authorization_url
                ):
                    return Response(
                        {
                            "detail": (
                                "An unfinished Paystack payment already exists. "
                                "Continue the existing payment."
                            ),
                            "payment": PaymentSerializer(existing_payment).data,
                            "renewal_status": locked_renewal.status,
                            "authorization_url": (
                                existing_payment.paystack_authorization_url
                            ),
                            "access_code": existing_payment.paystack_access_code,
                            "reference": existing_payment.reference,
                        },
                        status=status.HTTP_200_OK,
                    )

                # Reuses failed or incomplete attempts instead of creating another row.
                payment = existing_payment
                payment.payment_method = requested_method
                payment.reference = (
                    f"UH-REN-{locked_renewal.id}-"
                    f"{uuid.uuid4().hex[:12].upper()}"
                )
                payment.status = "pending"
                payment.amount = locked_renewal.expected_amount
                payment.expected_amount = locked_renewal.expected_amount
                payment.duration_months = (
                    locked_renewal.requested_duration_months
                )
                payment.paystack_access_code = ""
                payment.paystack_authorization_url = ""
                payment.paystack_response = None
                payment.verified_at = None
                payment.platform_commission = Decimal("0.00")
                payment.paystack_fee = Decimal("0.00")
                payment.owner_net_amount = Decimal("0.00")
                payment.settlement_status = (
                    "pending"
                    if requested_method == "paystack"
                    else "not_applicable"
                )
                payment.save(
                    update_fields=[
                        "payment_method",
                        "reference",
                        "status",
                        "amount",
                        "expected_amount",
                        "duration_months",
                        "paystack_access_code",
                        "paystack_authorization_url",
                        "paystack_response",
                        "verified_at",
                        "platform_commission",
                        "paystack_fee",
                        "owner_net_amount",
                        "settlement_status",
                        "updated_at",
                    ]
                )
            else:
                payment = Payment.objects.create(
                    booking=None,
                    renewal_request=locked_renewal,
                    tenant=locked_renewal.tenant,
                    landlord=locked_renewal.landlord,
                    property=locked_renewal.property,
                    room=locked_renewal.room,
                    payment_type="renewal",
                    payment_method=requested_method,
                    duration_months=(
                        locked_renewal.requested_duration_months
                    ),
                    amount=locked_renewal.expected_amount,
                    expected_amount=locked_renewal.expected_amount,
                    reference=(
                        f"UH-REN-{locked_renewal.id}-"
                        f"{uuid.uuid4().hex[:12].upper()}"
                    ),
                    status="pending",
                    settlement_status=(
                        "pending"
                        if requested_method == "paystack"
                        else "not_applicable"
                    ),
                )
                created_new_payment = True

        # Returns direct payment requests for owner confirmation.
        if requested_method == "direct":
            try:
                tenant_name = (
                    payment.tenant.get_full_name().strip()
                    or payment.tenant.username
                    or payment.tenant.email
                )
                send_notification(
                    user=payment.landlord,
                    message=(
                        f"{tenant_name} selected direct payment for the "
                        f"{payment.duration_months}-month renewal of "
                        f"{payment.property.property_name}. "
                        f"Expected amount: GHS {payment.amount}."
                    ),
                    notification_type="renewal_direct_payment_requested",
                    property_id=payment.property_id,
                )
            except Exception as exc:
                print(
                    "RENEWAL DIRECT PAYMENT NOTIFICATION FAILED:",
                    repr(exc),
                    flush=True,
                )

            return Response(
                {
                    "detail": (
                        "Direct renewal payment request created successfully. "
                        "Pay the owner and wait for confirmation."
                    ),
                    "payment": PaymentSerializer(payment).data,
                    "renewal_status": locked_renewal.status,
                    "authorization_url": None,
                },
                status=(
                    status.HTTP_201_CREATED
                    if created_new_payment
                    else status.HTTP_200_OK
                ),
            )

        # Loads the owner's verified Paystack account.
        try:
            owner_account = OwnerPaymentAccount.objects.get(
                owner=payment.landlord,
                is_active=True,
                is_verified=True,
            )
        except OwnerPaymentAccount.DoesNotExist:
            if created_new_payment:
                payment.delete()
            else:
                payment.status = "failed"
                payment.save(update_fields=["status", "updated_at"])

            return Response(
                {
                    "detail": (
                        "The property owner does not have an active "
                        "verified payment account."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not owner_account.paystack_subaccount_code:
            if created_new_payment:
                payment.delete()
            else:
                payment.status = "failed"
                payment.save(update_fields=["status", "updated_at"])

            return Response(
                {
                    "detail": (
                        "The property owner's Paystack subaccount "
                        "is not configured."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        frontend_url = getattr(
            settings,
            "FRONTEND_URL",
            "http://localhost:5173",
        ).rstrip("/")

        callback_url = (
            f"{frontend_url}/renewals/payment/verify"
            f"?reference={payment.reference}"
        )

        try:
            paystack_data = initialize_paystack_payment(
                email=payment.tenant.email,
                amount=payment.amount,
                reference=payment.reference,
                callback_url=callback_url,
                subaccount_code=owner_account.paystack_subaccount_code,
                bearer="subaccount",
            )
        except PaystackError as exc:
            payment.status = "failed"
            payment.save(update_fields=["status", "updated_at"])

            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.paystack_access_code = paystack_data.get(
            "access_code",
            "",
        )
        payment.paystack_authorization_url = paystack_data.get(
            "authorization_url",
            "",
        )
        payment.save(
            update_fields=[
                "paystack_access_code",
                "paystack_authorization_url",
                "updated_at",
            ]
        )

        return Response(
            {
                "detail": "Renewal payment initialized successfully.",
                "payment": PaymentSerializer(payment).data,
                "renewal_status": locked_renewal.status,
                "authorization_url": payment.paystack_authorization_url,
                "access_code": payment.paystack_access_code,
                "reference": payment.reference,
            },
            status=(
                status.HTTP_201_CREATED
                if created_new_payment
                else status.HTTP_200_OK
            ),
        )


class VerifyRenewalPaymentView(APIView):
    # Requires the renewal tenant to be authenticated.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, reference):
        try:
            # Loads only the tenant's Paystack renewal payment.
            payment = (
                Payment.objects.select_related(
                    "renewal_request",
                    "renewal_request__current_lease",
                    "tenant",
                    "landlord",
                    "property",
                    "room",
                )
                .get(
                    reference=reference,
                    tenant=request.user,
                    payment_type="renewal",
                    payment_method="paystack",
                )
            )
        except Payment.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Renewal payment not found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Returns the stored result without verifying twice.
        if payment.status == "success":
            return Response(
                {
                    "detail": (
                        "Renewal payment already verified."
                    ),
                    "payment": PaymentSerializer(
                        payment
                    ).data,
                    "renewal_status": (
                        payment.renewal_request.status
                    ),
                },
                status=status.HTTP_200_OK,
            )

        try:
            # Verifies the transaction directly with Paystack.
            paystack_data = verify_paystack_payment(
                reference
            )
        except PaystackError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Rejects unsuccessful Paystack transactions.
        if paystack_data.get("status") != "success":
            payment.status = "failed"
            payment.paystack_response = paystack_data

            payment.save(
                update_fields=[
                    "status",
                    "paystack_response",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "detail": (
                        "Renewal payment was not successful."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Converts Paystack's pesewa value into Ghana cedis.
        paid_amount = (
            Decimal(
                str(
                    paystack_data.get(
                        "amount",
                        0,
                    )
                )
            )
            / Decimal("100")
        ).quantize(
            Decimal("0.01")
        )

        expected_amount = Decimal(
            str(
                payment.renewal_request.expected_amount
            )
        ).quantize(
            Decimal("0.01")
        )

        # Requires an exact secure renewal payment amount.
        if paid_amount != expected_amount:
            payment.status = "failed"
            payment.paystack_response = paystack_data

            payment.save(
                update_fields=[
                    "status",
                    "paystack_response",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "detail": (
                        "The Paystack amount does not match "
                        "the approved renewal amount."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Locks payment and renewal records together.
            locked_payment = (
                Payment.objects.select_for_update()
                .select_related(
                    "renewal_request",
                    "tenant",
                    "landlord",
                    "property",
                    "room",
                )
                .get(pk=payment.pk)
            )

            renewal = (
                LeaseRenewalRequest.objects
                .select_for_update()
                .select_related(
                    "current_lease",
                    "tenant",
                    "landlord",
                    "property",
                    "room",
                )
                .get(
                    pk=locked_payment.renewal_request_id
                )
            )

            # Handles repeated verification safely.
            if locked_payment.status == "success":
                return Response(
                    {
                        "detail": (
                            "Renewal payment already verified."
                        ),
                        "payment": PaymentSerializer(
                            locked_payment
                        ).data,
                        "renewal_status": renewal.status,
                    },
                    status=status.HTTP_200_OK,
                )

            # Requires the renewal to still await payment.
            if renewal.status != "payment_pending":
                return Response(
                    {
                        "detail": (
                            "This renewal is no longer "
                            "awaiting payment."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Requires the current lease to remain active.
            if renewal.current_lease.status != "active":
                return Response(
                    {
                        "detail": (
                            "The current lease is no longer active."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Calculates UrbanHavens commission.
            platform_commission = (
                locked_payment.amount
                * Decimal("0.01")
            ).quantize(
                Decimal("0.01")
            )

            # Converts Paystack's fee into Ghana cedis.
            paystack_fee = (
                Decimal(
                    str(
                        paystack_data.get(
                            "fees",
                            0,
                        )
                    )
                )
                / Decimal("100")
            ).quantize(
                Decimal("0.01")
            )

            # Calculates the owner's expected settlement amount.
            owner_amount = (
                locked_payment.amount
                - platform_commission
                - paystack_fee
            ).quantize(
                Decimal("0.01")
            )

            # Generates the official renewal receipt.
            locked_payment.finalize_receipt(
                amount_received=paid_amount,
                expected_amount=expected_amount,
            )

            # Marks the payment as successful.
            locked_payment.status = "success"
            locked_payment.verified_at = timezone.now()
            locked_payment.paystack_response = paystack_data
            locked_payment.platform_commission = (
                platform_commission
            )
            locked_payment.paystack_fee = paystack_fee
            locked_payment.owner_net_amount = owner_amount
            locked_payment.settlement_status = "pending"

            locked_payment.save(
                update_fields=[
                    "status",
                    "verified_at",
                    "paystack_response",
                    "platform_commission",
                    "paystack_fee",
                    "owner_net_amount",
                    "settlement_status",
                    "expected_amount",
                    "amount_received",
                    "payment_completion_status",
                    "outstanding_balance",
                    "receipt_number",
                    "receipt_generated_at",
                    "updated_at",
                ]
            )

            # Moves the renewal to final owner completion.
            renewal.status = "payment_completed"
            renewal.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

        try:
            # Notifies the landlord about successful payment.
            send_notification(
                user=locked_payment.landlord,
                message=(
                    f"Renewal payment of GHS "
                    f"{locked_payment.amount_received} "
                    f"was received for "
                    f"{locked_payment.property.property_name}. "
                    f"Receipt: "
                    f"{locked_payment.receipt_number}. "
                    f"Complete the renewal to create "
                    f"the new lease."
                ),
                notification_type=(
                    "renewal_payment_received"
                ),
                property_id=locked_payment.property_id,
            )

            # Notifies the tenant that payment succeeded.
            send_notification(
                user=locked_payment.tenant,
                message=(
                    f"Your renewal payment for "
                    f"{locked_payment.property.property_name} "
                    f"was verified successfully. "
                    f"Receipt: "
                    f"{locked_payment.receipt_number}."
                ),
                notification_type=(
                    "renewal_payment_verified"
                ),
                property_id=locked_payment.property_id,
            )
        except Exception as exc:
            print(
                "RENEWAL PAYSTACK NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Renewal payment verified successfully. "
                    "A receipt has been generated."
                ),
                "payment": PaymentSerializer(
                    locked_payment
                ).data,
                "renewal_status": renewal.status,
                "receipt": {
                    "receipt_number": (
                        locked_payment.receipt_number
                    ),
                    "expected_amount": str(
                        locked_payment.expected_amount
                    ),
                    "amount_received": str(
                        locked_payment.amount_received
                    ),
                    "payment_status": (
                        locked_payment
                        .payment_completion_status
                    ),
                    "outstanding_balance": str(
                        locked_payment.outstanding_balance
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )


class ConfirmDirectRenewalPaymentView(APIView):
    # Requires an authenticated landlord.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, payment_id):
        serializer = (
            ConfirmDirectRenewalPaymentSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = request.user
        role = getattr(user, "role", None)

        # Restricts confirmation to owners and administrators.
        if not (
            user.is_superuser
            or role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only the property owner can confirm "
                "a direct renewal payment."
            )

        amount_received = serializer.validated_data[
            "amount_received"
        ]

        confirmation_note = serializer.validated_data[
            "confirmation_note"
        ].strip()

        with transaction.atomic():
            try:
                # Locks the payment and its renewal request.
                payment = (
                    Payment.objects.select_for_update()
                    .select_related(
                        "renewal_request",
                        "renewal_request__current_lease",
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                    )
                    .get(
                        id=payment_id,
                        payment_type="renewal",
                        payment_method="direct",
                    )
                )
            except Payment.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "Direct renewal payment not found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Restricts ordinary owners to their own payments.
            if not (
                user.is_superuser
                or role == "admin"
                or payment.landlord_id == user.id
            ):
                raise PermissionDenied(
                    "You cannot confirm another owner's "
                    "renewal payment."
                )

            if payment.status != "pending":
                return Response(
                    {
                        "detail": (
                            "This direct renewal payment has "
                            "already been processed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            renewal = (
                LeaseRenewalRequest.objects
                .select_for_update()
                .select_related(
                    "current_lease",
                    "tenant",
                    "landlord",
                    "property",
                    "room",
                )
                .get(
                    pk=payment.renewal_request_id
                )
            )

            if renewal.status != "payment_pending":
                return Response(
                    {
                        "detail": (
                            "This renewal is no longer "
                            "awaiting payment."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if renewal.current_lease.status != "active":
                return Response(
                    {
                        "detail": (
                            "The current lease is no longer active."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            expected_amount = Decimal(
                str(renewal.expected_amount)
            ).quantize(
                Decimal("0.01")
            )

            # Requires full payment before renewal completion.
            if amount_received < expected_amount:
                return Response(
                    {
                        "amount_received": (
                            "A lease renewal requires full "
                            "payment before it can proceed."
                        ),
                        "expected_amount": str(
                            expected_amount
                        ),
                        "amount_received_value": str(
                            amount_received
                        ),
                        "outstanding_balance": str(
                            expected_amount - amount_received
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Generates the official direct renewal receipt.
            payment.finalize_receipt(
                amount_received=amount_received,
                expected_amount=expected_amount,
            )

            payment.status = "success"
            payment.verified_at = timezone.now()
            payment.platform_commission = Decimal(
                "0.00"
            )
            payment.paystack_fee = Decimal("0.00")
            payment.owner_net_amount = (
                amount_received
            )
            payment.settlement_status = (
                "not_applicable"
            )

            payment.save(
                update_fields=[
                    "status",
                    "verified_at",
                    "platform_commission",
                    "paystack_fee",
                    "owner_net_amount",
                    "settlement_status",
                    "expected_amount",
                    "amount_received",
                    "payment_completion_status",
                    "outstanding_balance",
                    "receipt_number",
                    "receipt_generated_at",
                    "updated_at",
                ]
            )

            # Stores the optional owner confirmation note.
            if confirmation_note:
                renewal.notes = (
                    f"{renewal.notes or ''}\n"
                    f"[Direct payment confirmation] "
                    f"{confirmation_note}"
                ).strip()

            # Moves the renewal to final owner completion.
            renewal.status = "payment_completed"

            renewal.save(
                update_fields=[
                    "status",
                    "notes",
                    "updated_at",
                ]
            )

        try:
            # Notifies the tenant about direct confirmation.
            send_notification(
                user=payment.tenant,
                message=(
                    f"Your direct renewal payment of "
                    f"GHS {payment.amount_received} for "
                    f"{payment.property.property_name} "
                    f"was confirmed. Receipt: "
                    f"{payment.receipt_number}. "
                    f"The owner can now complete the renewal."
                ),
                notification_type=(
                    "renewal_direct_payment_confirmed"
                ),
                property_id=payment.property_id,
            )
        except Exception as exc:
            print(
                "RENEWAL DIRECT PAYMENT "
                "NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Direct renewal payment confirmed "
                    "successfully. A receipt has been generated."
                ),
                "payment": PaymentSerializer(
                    payment
                ).data,
                "renewal_status": renewal.status,
                "receipt": {
                    "receipt_number": (
                        payment.receipt_number
                    ),
                    "expected_amount": str(
                        payment.expected_amount
                    ),
                    "amount_received": str(
                        payment.amount_received
                    ),
                    "payment_status": (
                        payment.payment_completion_status
                    ),
                    "outstanding_balance": str(
                        payment.outstanding_balance
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )