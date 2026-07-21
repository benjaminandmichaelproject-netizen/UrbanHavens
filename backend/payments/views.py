from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from notifications.utils import send_notification
from system_logs.logger import log_sms_failure, log_sms_success
from notifications.sms import send_rent_payment_received_sms
from bookings.models import Booking
from leases.models import TenantLease
from properties.models import Property, Room

from .models import OwnerPaymentAccount, Payment
from .paystack import (
    PaystackError,
    create_paystack_subaccount,
  
    initialize_paystack_payment,
    resolve_ghana_mobile_money_code,
    verify_paystack_payment,
)
from .serializers import (
    ConfirmDirectPaymentSerializer,
    InitializePaymentSerializer,
    OwnerPaymentAccountSerializer,
    PaymentSerializer,
)


class OwnerPaymentAccountView(generics.RetrieveUpdateAPIView):
    """
    Allow a landlord to save a Ghana mobile-money settlement account.

    On update, Django creates a real Paystack subaccount using the
    landlord's submitted details. React never submits or controls the
    Paystack subaccount code.
    """

    serializer_class = OwnerPaymentAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user

        if getattr(user, "role", None) not in ["owner", "landlord"]:
            raise PermissionDenied(
                "Only property owners can add payment account details."
            )

        account, _ = OwnerPaymentAccount.objects.get_or_create(
            owner=user,
            defaults={
                "account_name": user.get_full_name() or user.email,
                "phone_number": "0000000000",
                "provider": "mtn",
                "is_active": False,
                "is_verified": False,
            },
        )

        return account

    def perform_update(self, serializer):
        owner = self.request.user
        provider = serializer.validated_data.get(
            "provider",
            serializer.instance.provider,
        )

        if provider == "bank":
            raise PermissionDenied(
                "Bank settlement is not enabled yet. "
                "Use MTN, Telecel or AirtelTigo Mobile Money."
            )

        # First save the owner's latest submitted details as inactive.
        account = serializer.save(
            owner=owner,
            is_active=False,
            is_verified=False,
            paystack_subaccount_code=None,
        )

        try:
            bank_code = resolve_ghana_mobile_money_code(
                account.provider
            )

            subaccount_data = create_paystack_subaccount(
                business_name=account.account_name,
                bank_code=bank_code,
                account_number=account.phone_number,
                percentage_charge=getattr(
                    settings,
                    "URBANHAVENS_COMMISSION_PERCENT",
                    1,
                ),
                contact_email=owner.email or "",
                contact_phone=account.phone_number,
            )
        except PaystackError as exc:
            raise PermissionDenied(str(exc)) from exc

        subaccount_code = subaccount_data.get("subaccount_code")

        if not subaccount_code:
            raise PermissionDenied(
                "Paystack did not return a subaccount code."
            )

        account.paystack_subaccount_code = subaccount_code
        account.is_active = True
        account.is_verified = True
        account.save(
            update_fields=[
                "paystack_subaccount_code",
                "is_active",
                "is_verified",
                "updated_at",
            ]
        )


class InitializePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InitializePaymentSerializer(
         data=request.data,
          context={"request": request},
           )
        serializer.is_valid(raise_exception=True)

        # Uses only the booking and room resolved by secure serializer validation.
        booking = serializer.validated_data["_resolved_booking"]
        selected_room = serializer.validated_data.get("_resolved_room")
        duration_months = serializer.validated_data["duration_months"]
        payment_method = serializer.validated_data["payment_method"]

        if booking.status not in [
            "inspection_completed",
            "payment_pending",
        ]:
            return Response(
                {
                    "detail": (
                        "You can only continue with payment after "
                        "the inspection has been completed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj = booking.property
        landlord = booking.owner

        if not property_obj.is_available:
            return Response(
                {"detail": "This property is no longer available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if property_obj.owner_id != booking.owner_id:
            return Response(
                {
                    "detail": (
                        "The booking landlord does not match "
                        "the property owner."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            allowed_durations = [
                int(months)
                for months in (
                    property_obj.allowed_rental_months or []
                )
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": (
                        "The property's rental duration configuration "
                        "is invalid."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if duration_months not in allowed_durations:
            return Response(
                {
                    "detail": (
                        "The selected rental duration is not "
                        "approved for this property."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if TenantLease.objects.filter(
            booking=booking,
            status="active",
        ).exists():
            return Response(
                {
                    "detail": (
                        "An active lease already exists "
                        "for this booking."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if TenantLease.objects.filter(
            tenant=request.user,
            property=property_obj,
            status="active",
        ).exists():
            return Response(
                {
                    "detail": (
                        "You already have an active lease "
                        "for this property."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner_payment_account = None

        if payment_method == "paystack":
            try:
                owner_payment_account = OwnerPaymentAccount.objects.get(
                    owner=landlord,
                    is_active=True,
                    is_verified=True,
                )
            except OwnerPaymentAccount.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "The property owner has not completed "
                            "their Paystack payment account setup."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not owner_payment_account.paystack_subaccount_code:
                return Response(
                    {
                        "detail": (
                            "The property owner does not have a valid "
                            "Paystack subaccount."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Uses the room price override for hostels when configured.
        monthly_rent = Decimal(
            str(
                selected_room.price_override
                if (
                    selected_room
                    and selected_room.price_override is not None
                )
                else property_obj.price
            )
        )
        amount = monthly_rent * Decimal(str(duration_months))

        if amount <= Decimal("0.00"):
            return Response(
                {
                    "detail": (
                        "Calculated payment amount must be "
                        "greater than zero."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_payment = Payment.objects.filter(
            booking=booking
        ).first()

        if (
            existing_payment
            and existing_payment.status == "success"
        ):
            return Response(
                {
                    "detail": (
                        "Payment has already been completed "
                        "for this booking."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if existing_payment:
                payment = existing_payment
                payment.tenant = request.user
                payment.landlord = landlord
                payment.property = property_obj
                payment.room = selected_room
                payment.payment_type = "rent"
                payment.payment_method = payment_method
                payment.duration_months = duration_months
                payment.amount = amount
                payment.status = "pending"
                payment.paystack_access_code = ""
                payment.paystack_authorization_url = ""
                payment.paystack_response = None
                payment.verified_at = None

                payment.save(
                    update_fields=[
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                        "payment_type",
                        "payment_method",
                        "duration_months",
                        "amount",
                        "status",
                        "paystack_access_code",
                        "paystack_authorization_url",
                        "paystack_response",
                        "verified_at",
                        "updated_at",
                    ]
                )
            else:
                payment = Payment.objects.create(
                    tenant=request.user,
                    landlord=landlord,
                    booking=booking,
                    property=property_obj,
                    room=selected_room,
                    payment_type="rent",
                    payment_method=payment_method,
                    duration_months=duration_months,
                    amount=amount,
                    status="pending",
                )

        if payment_method == "direct":
            booking.status = "payment_pending"
            booking.save(update_fields=["status"])

            return Response(
                {
                    "detail": (
                        "Direct payment selected. Pay the owner "
                        "and wait for payment confirmation."
                    ),
                    "payment_method": "direct",
                    "booking_status": booking.status,
                    "duration_months": duration_months,
                    "monthly_rent": str(monthly_rent),
                    "amount": str(amount),
                    "room_id": selected_room.id if selected_room else None,
                    "payment": PaymentSerializer(payment).data,
                },
                status=status.HTTP_200_OK,
            )

        callback_url = (
            f"{settings.FRONTEND_URL}"
            f"/payment/verify/{payment.reference}"
        )

        try:
            paystack_data = initialize_paystack_payment(
                email=request.user.email,
                amount=payment.amount,
                reference=payment.reference,
                callback_url=callback_url,
                subaccount_code=(
                    owner_payment_account.paystack_subaccount_code
                ),
                bearer="subaccount",
            )
        except PaystackError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
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

            booking.status = "payment_pending"
            booking.save(update_fields=["status"])

        return Response(
            {
                "detail": (
                    "Payment initialized successfully with "
                    "the landlord's Paystack subaccount."
                ),
                "payment_method": "paystack",
                "authorization_url": (
                    payment.paystack_authorization_url
                ),
                "reference": str(payment.reference),
                "booking_status": booking.status,
                "duration_months": duration_months,
                "monthly_rent": str(monthly_rent),
                "amount": str(amount),
                "room_id": selected_room.id if selected_room else None,
                "payment": PaymentSerializer(payment).data,
            },
            status=status.HTTP_200_OK,
        )


class VerifyPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, reference):
        # Loads only the authenticated tenant's payment.
        try:
            payment = Payment.objects.select_related(
                "booking",
                "property",
                "tenant",
                "landlord",
                "room",
            ).get(
                reference=reference,
                tenant=request.user,
            )
        except Payment.DoesNotExist:
            return Response(
                {"detail": "Payment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Restricts this endpoint to Paystack payments.
        if payment.payment_method != "paystack":
            return Response(
                {
                    "detail": (
                        "Only Paystack payments can be verified "
                        "through this endpoint."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Returns the stored result without verifying twice.
        if payment.status == "success":
            lease = TenantLease.objects.filter(
                booking=payment.booking
            ).first()

            return Response(
                {
                    "detail": (
                        "Payment already verified. The property is "
                        "reserved and awaiting lease creation."
                    ),
                    "payment": PaymentSerializer(payment).data,
                    "booking_status": payment.booking.status,
                    "lease_id": lease.id if lease else None,
                    "receipt": {
                        "receipt_number": payment.receipt_number,
                        "expected_amount": str(
                            payment.expected_amount
                        ),
                        "amount_received": str(
                            payment.amount_received
                        ),
                        "payment_status": (
                            payment.payment_completion_status
                        ),
                        "payment_status_display": (
                            payment.get_payment_completion_status_display()
                        ),
                        "outstanding_balance": str(
                            payment.outstanding_balance
                        ),
                        "generated_at": (
                            payment.receipt_generated_at
                        ),
                    },
                },
                status=status.HTTP_200_OK,
            )

        # Verifies the payment directly with Paystack.
        try:
            paystack_data = verify_paystack_payment(reference)
        except PaystackError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Records a failed Paystack transaction.
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
                {"detail": "Payment was not successful."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Converts Paystack's pesewa amount into Ghana cedis.
        paid_amount = (
            Decimal(str(paystack_data.get("amount", 0)))
            / Decimal("100")
        ).quantize(Decimal("0.01"))

        duration_months = payment.duration_months
        property_obj = payment.property

        # Validates the stored duration against owner-approved options.
        try:
            allowed_durations = [
                int(months)
                for months in (
                    property_obj.allowed_rental_months or []
                )
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": (
                        "The property's rental duration configuration "
                        "is invalid."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if duration_months not in allowed_durations:
            return Response(
                {
                    "detail": (
                        "The stored rental duration is no longer "
                        "approved for this property."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Uses the room price for hostels and property price for houses.
        effective_monthly_rent = (
            payment.room.price_override
            if (
                payment.room
                and payment.room.price_override is not None
            )
            else property_obj.price
        )

        # Recalculates the expected amount from trusted backend data.
        expected_amount = (
            Decimal(str(effective_monthly_rent))
            * Decimal(str(duration_months))
        ).quantize(Decimal("0.01"))

        # Rejects any payment whose Paystack amount was altered.
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
                        "Payment amount does not match the secure "
                        "rental calculation."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Confirms the stored payment amount matches the calculation.
        if payment.amount != expected_amount:
            return Response(
                {
                    "detail": (
                        "Stored payment amount does not match the "
                        "property rent and selected duration."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Locks all affected records to prevent double reservation.
        with transaction.atomic():
                        # Locks only the payment row.
            # Related records are locked separately below.
            locked_payment = (
                Payment.objects.select_for_update()
                .get(pk=payment.pk)
            )

            # Locks the booking while its status changes.
            booking = (
                Booking.objects.select_for_update()
                .get(pk=locked_payment.booking_id)
            )

            # Locks the property while it is reserved.
            locked_property = (
                Property.objects.select_for_update()
                .get(pk=locked_payment.property_id)
            )

            # Locks the selected hostel room before reservation.
            locked_room = None

            if locked_property.category == "hostel":
                if not locked_payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "A room is required for hostel payment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    locked_room = (
                        Room.objects.select_for_update()
                        .get(
                            pk=locked_payment.room_id,
                            property=locked_property,
                        )
                    )
                except Room.DoesNotExist:
                    return Response(
                        {
                            "detail": (
                                "The selected hostel room is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Handles repeated verification requests safely.
            if locked_payment.status == "success":
                lease = TenantLease.objects.filter(
                    booking=booking
                ).first()

                return Response(
                    {
                        "detail": (
                            "Payment already verified. The property is "
                            "reserved and awaiting lease creation."
                        ),
                        "payment": PaymentSerializer(
                            locked_payment
                        ).data,
                        "booking_status": booking.status,
                        "lease_id": lease.id if lease else None,
                        "receipt_number": (
                            locked_payment.receipt_number
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            # Allows verification only for payment-pending bookings.
            if booking.status != "payment_pending":
                return Response(
                    {
                        "detail": (
                            "This booking is not awaiting payment "
                            "confirmation."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Confirms the selected room or house remains available.
            if locked_property.category == "hostel":
                if (
                    not locked_room.is_available
                    or locked_room.available_spaces() <= 0
                ):
                    return Response(
                        {
                            "detail": (
                                "The selected room is no longer "
                                "available."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif not locked_property.is_available:
                return Response(
                    {
                        "detail": (
                            "This property is no longer available."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents duplicate lease creation for the booking.
            if TenantLease.objects.filter(
                booking=booking
            ).exists():
                return Response(
                    {
                        "detail": (
                            "A lease already exists for this booking."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents a house from being reserved over an active lease.
            if (
                locked_property.category != "hostel"
                and TenantLease.objects.filter(
                    property=locked_property,
                    status="active",
                ).exists()
            ):
                return Response(
                    {
                        "detail": (
                            "This property already has an active lease."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Calculates UrbanHavens' commission.
            platform_commission = (
                locked_payment.amount * Decimal("0.01")
            ).quantize(Decimal("0.01"))

            # Converts Paystack's fee from pesewas into Ghana cedis.
            paystack_fee = (
                Decimal(str(paystack_data.get("fees", 0)))
                / Decimal("100")
            ).quantize(Decimal("0.01"))

            # Calculates the amount expected to settle to the owner.
            owner_amount = (
                locked_payment.amount
                - platform_commission
                - paystack_fee
            ).quantize(Decimal("0.01"))

            # Generates and classifies the official payment receipt.
            locked_payment.finalize_receipt(
                amount_received=paid_amount,
                expected_amount=expected_amount,
            )

            # Marks the Paystack payment successful.
            locked_payment.status = "success"
            locked_payment.verified_at = timezone.now()
            locked_payment.paystack_response = paystack_data
            locked_payment.platform_commission = (
                platform_commission
            )
            locked_payment.paystack_fee = paystack_fee
            locked_payment.owner_net_amount = owner_amount
            locked_payment.settlement_status = "pending"

            # Saves payment, settlement, and receipt information.
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

            # Moves the booking into the awaiting-lease stage.
            booking.status = "payment_completed"
            booking.save(
                update_fields=["status"]
            )

            # Reserves one hostel space or the entire house.
            if locked_room:
                locked_room.reserved_spaces += 1
                locked_room.save()
            else:
                locked_property.is_available = False
                locked_property.save(
                    update_fields=["is_available"]
                )

        try:
            # Notifies the landlord after payment confirmation.
            send_notification(
                user=locked_payment.landlord,
                message=(
                    f"You have received a rent payment of "
                    f"GHS {locked_payment.amount_received} for "
                    f"{locked_property.property_name}. "
                    f"Payment status: "
                    f"{locked_payment.get_payment_completion_status_display()}. "
                    f"Receipt number: "
                    f"{locked_payment.receipt_number}. "
                    f"Expected settlement: "
                    f"GHS {locked_payment.owner_net_amount}. "
                    f"The property is awaiting lease creation."
                ),
                notification_type="rent_payment_received",
                property_id=locked_property.id,
            )

            print(
                "OWNER PAYMENT NOTIFICATION SENT",
                flush=True,
            )
        except Exception as exc:
            print(
                "OWNER PAYMENT NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        try:
            # Sends the existing owner payment SMS.
            sms_result = send_rent_payment_received_sms(
                locked_payment
            )

            print(
                "OWNER PAYMENT SMS RESULT:",
                sms_result,
                flush=True,
            )
        except Exception as exc:
            print(
                "OWNER PAYMENT SMS FAILED:",
                repr(exc),
                flush=True,
            )

            # Logs SMS failure without reversing payment.
            log_sms_failure(
                message="Rent payment SMS failed.",
                phone=(
                    locked_payment.landlord.phone or ""
                ),
                booking_id=booking.id,
                detail=str(exc),
            )

        # Returns reservation and official receipt details.
        return Response(
            {
                "detail": (
                    "Payment verified successfully. A receipt has "
                    "been generated and the property is awaiting "
                    "lease creation."
                ),
                "payment": PaymentSerializer(
                    locked_payment
                ).data,
                "booking_status": booking.status,
                "property_reserved": True,
                "room_id": (
                    locked_room.id
                    if locked_room
                    else None
                ),
                "lease_id": None,
                "duration_months": duration_months,
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
                        locked_payment.payment_completion_status
                    ),
                    "payment_status_display": (
                        locked_payment
                        .get_payment_completion_status_display()
                    ),
                    "outstanding_balance": str(
                        locked_payment.outstanding_balance
                    ),
                    "generated_at": (
                        locked_payment.receipt_generated_at
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )




class OwnerPaymentsView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if getattr(user, "role", None) not in ["owner", "landlord"]:
            raise PermissionDenied(
                "Only property owners can view these payments."
            )

        queryset = (
            Payment.objects.select_related(
                "tenant",
                "landlord",
                "property",
                "booking",
            )
            .filter(
                landlord=user,
                status="success",
                payment_method="paystack",
            )
            .order_by("-created_at")
        )

        settlement_status = self.request.query_params.get(
            "settlement_status"
        )

        if settlement_status:
            allowed_statuses = {
                "pending",
                "processing",
                "paid",
                "failed",
            }

            if settlement_status not in allowed_statuses:
                return queryset.none()

            queryset = queryset.filter(
                settlement_status=settlement_status
            )

        return queryset

class OwnerOnsitePaymentsView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if getattr(user, "role", None) not in ["owner", "landlord"]:
            raise PermissionDenied(
                "Only property owners can view on-site payments."
            )

        return (
            Payment.objects.select_related(
                "tenant",
                "landlord",
                "property",
                "booking",
            )
            .filter(
                landlord=user,
                payment_method="direct",
                status="pending",
            )
            .order_by("-created_at")
        )    
    
class ConfirmDirectPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, payment_id):
        # Validates the amount the owner confirms receiving.
        serializer = ConfirmDirectPaymentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        amount_received = serializer.validated_data[
            "amount_received"
        ]
        confirmation_note = serializer.validated_data[
            "confirmation_note"
        ]

        # Restricts direct-payment confirmation to property owners.
        if getattr(user, "role", None) not in [
            "owner",
            "landlord",
        ]:
            raise PermissionDenied(
                "Only property owners can confirm direct payments."
            )

        with transaction.atomic():
            try:
                # Locks the payment to prevent duplicate confirmation.
             # Locks only the payment row.
                    # Booking, property, and room are locked separately below.
                payment = (
                    Payment.objects.select_for_update()
                    .get(
                        id=payment_id,
                        landlord=user,
                        payment_method="direct",
                    )
                )
            except Payment.DoesNotExist:
                return Response(
                    {"detail": "Direct payment not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Prevents an already processed payment from being confirmed again.
            if payment.status != "pending":
                return Response(
                    {
                        "detail": (
                            "This direct payment has already been "
                            "processed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Locks the booking during payment confirmation.
            booking = (
                Booking.objects.select_for_update()
                .get(pk=payment.booking_id)
            )

            # Locks the property while it is being reserved.
            property_obj = (
                Property.objects.select_for_update()
                .get(pk=payment.property_id)
            )

            # Locks the selected hostel room before reservation.
            selected_room = None

            if property_obj.category == "hostel":
                if not payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "A room is required for hostel payment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    selected_room = (
                        Room.objects.select_for_update()
                        .get(
                            pk=payment.room_id,
                            property=property_obj,
                        )
                    )
                except Room.DoesNotExist:
                    return Response(
                        {
                            "detail": (
                                "The selected hostel room is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Ensures the booking is awaiting payment confirmation.
            if booking.status != "payment_pending":
                return Response(
                    {
                        "detail": (
                            "This booking is not awaiting direct "
                            "payment confirmation."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Confirms that the room or house remains available.
            if property_obj.category == "hostel":
                if (
                    not selected_room.is_available
                    or selected_room.available_spaces() <= 0
                ):
                    return Response(
                        {
                            "detail": (
                                "The selected room is no longer "
                                "available."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif not property_obj.is_available:
                return Response(
                    {
                        "detail": (
                            "This property is no longer available."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Confirms that the logged-in owner owns the property.
            if property_obj.owner_id != user.id:
                return Response(
                    {
                        "detail": (
                            "You do not own the property linked "
                            "to this payment."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Prevents confirmation where a lease already exists.
            if TenantLease.objects.filter(
                booking=booking
            ).exists():
                return Response(
                    {
                        "detail": (
                            "A lease already exists for this booking."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents duplicate active tenancy for the same property.
            if TenantLease.objects.filter(
                tenant=payment.tenant,
                property=property_obj,
                status="active",
            ).exists():
                return Response(
                    {
                        "detail": (
                            "The tenant already has an active lease "
                            "for this property."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Calculates full or part payment and generates the receipt.
            payment.finalize_receipt(
                amount_received=amount_received,
                expected_amount=payment.amount,
            )

            # Records the confirmed direct payment without settlement fees.
            payment.status = "success"
            payment.verified_at = timezone.now()
            payment.settlement_status = "not_applicable"
            payment.platform_commission = Decimal("0.00")
            payment.paystack_fee = Decimal("0.00")
            payment.owner_net_amount = amount_received

            # Stores the owner's optional confirmation note.
            if confirmation_note:
                current_response = payment.paystack_response or {}
                current_response["direct_confirmation_note"] = (
                    confirmation_note
                )
                payment.paystack_response = current_response

            payment.save(
                update_fields=[
                    "status",
                    "verified_at",
                    "settlement_status",
                    "platform_commission",
                    "paystack_fee",
                    "owner_net_amount",
                    "expected_amount",
                    "amount_received",
                    "payment_completion_status",
                    "outstanding_balance",
                    "receipt_number",
                    "receipt_generated_at",
                    "paystack_response",
                    "updated_at",
                ]
            )

            # Moves the booking to the awaiting-lease stage.
            booking.status = "payment_completed"
            booking.save(
                update_fields=["status"]
            )

            # Reserves one hostel space or the entire house.
            if selected_room:
                selected_room.reserved_spaces += 1
                selected_room.save()
            else:
                property_obj.is_available = False
                property_obj.save(
                    update_fields=["is_available"]
                )

        try:
            # Notifies the tenant about confirmation and receipt status.
            send_notification(
                user=payment.tenant,
                message=(
                    f"Your direct payment of "
                    f"GHS {payment.amount_received} for "
                    f"{property_obj.property_name} was confirmed. "
                    f"Payment status: "
                    f"{payment.get_payment_completion_status_display()}. "
                    f"Receipt number: {payment.receipt_number}. "
                    f"The property is reserved while the owner "
                    f"prepares your lease."
                ),
                notification_type="direct_payment_confirmed",
                property_id=property_obj.id,
            )
        except Exception as exc:
            print(
                "DIRECT PAYMENT NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        # Returns payment, reservation, and receipt information.
        return Response(
            {
                "detail": (
                    "Direct payment confirmed successfully. "
                    "A receipt has been generated and the property "
                    "is awaiting lease creation."
                ),
                "payment": PaymentSerializer(payment).data,
                "booking_status": booking.status,
                "property_reserved": True,
                "room_id": (
                    selected_room.id
                    if selected_room
                    else None
                ),
                "lease_id": None,
                "receipt": {
                    "receipt_number": payment.receipt_number,
                    "expected_amount": str(
                        payment.expected_amount
                    ),
                    "amount_received": str(
                        payment.amount_received
                    ),
                    "payment_status": (
                        payment.payment_completion_status
                    ),
                    "payment_status_display": (
                        payment.get_payment_completion_status_display()
                    ),
                    "outstanding_balance": str(
                        payment.outstanding_balance
                    ),
                    "generated_at": (
                        payment.receipt_generated_at
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )
class RejectDirectPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, payment_id):
        user = request.user

        if getattr(user, "role", None) not in [
            "owner",
            "landlord",
        ]:
            raise PermissionDenied(
                "Only property owners can reject direct payments."
            )

        with transaction.atomic():

            try:
                            # Locks only the payment row.
                payment = (
                    Payment.objects.select_for_update()
                    .get(
                        id=payment_id,
                        landlord=user,
                        payment_method="direct",
                    )
                )

            except Payment.DoesNotExist:

                return Response(
                    {
                        "detail":
                        "Direct payment not found."
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if payment.status != "pending":

                return Response(
                    {
                        "detail":
                        "This payment has already been processed."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment.status = "failed"

            payment.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

            booking = payment.booking

            booking.status = "inspection_completed"

            booking.save(
                update_fields=[
                    "status",
                ]
            )

        try:

            send_notification(
                user=payment.tenant,
                message=(
                    f"Your direct payment for "
                    f"{payment.property.property_name} "
                    f"could not be confirmed by the owner."
                ),
                notification_type="direct_payment_rejected",
                property_id=payment.property.id,
            )

        except Exception as exc:

            print(
                "DIRECT PAYMENT REJECT NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail":
                "Direct payment rejected successfully."
            },
            status=status.HTTP_200_OK,
        )
 
 
    
class TenantTransactionsView(generics.ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if getattr(user, "role", None) != "tenant":
            raise PermissionDenied(
                "Only tenants can view these transactions."
            )

        queryset = (
            Payment.objects.select_related(
                "tenant",
                "landlord",
                "property",
                "booking",
            )
            .filter(tenant=user)
            .order_by("-created_at")
        )

        payment_status = self.request.query_params.get("status")

        if payment_status:
            allowed_statuses = {
                "pending",
                "success",
                "failed",
                "abandoned",
                "refunded",
            }

            if payment_status not in allowed_statuses:
                return queryset.none()

            queryset = queryset.filter(status=payment_status)

        return queryset   
    
    
    

class OwnerTransactionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Restricts transaction history to owners and administrators.
        if not (
            user.is_superuser
            or getattr(user, "role", None) in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only property owners can view owner transactions."
            )

        # Loads all payments belonging to the logged-in owner.
        payments = (
            Payment.objects.select_related(
                "tenant",
                "landlord",
                "booking",
                "property",
                "room",
            )
            .filter(
                landlord=user,
            )
            .order_by("-verified_at", "-created_at")
        )

        # Allows administrators to view all owner transactions.
        if user.is_superuser or getattr(
            user,
            "role",
            None,
        ) == "admin":
            payments = (
                Payment.objects.select_related(
                    "tenant",
                    "landlord",
                    "booking",
                    "property",
                    "room",
                )
                .all()
                .order_by(
                    "-verified_at",
                    "-created_at",
                )
            )

        serializer = PaymentSerializer(
            payments,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )    