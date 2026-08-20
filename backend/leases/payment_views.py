from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from notifications.utils import send_notification
from payments.models import Payment
from properties.models import ApartmentUnit, Property, Room

from .models import TenantLease
from .serializers import (
    CreateLeaseFromPaymentSerializer,
    TenantLeaseSerializer,
)


class AwaitingLeaseListView(generics.ListAPIView):
    """
    Returns successful payments that are waiting for lease creation.
    """

    serializer_class = TenantLeaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Restricts the awaiting-lease page to owners and administrators.
        if not (
            user.is_superuser
            or getattr(user, "role", None) in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only property owners can view awaiting leases."
            )

        # This view returns payment-backed records, not lease records.
        return TenantLease.objects.none()

    def list(self, request, *args, **kwargs):
        user = request.user
        role = getattr(user, "role", None)

        # Loads successful payments whose bookings await lease creation.
        payments = (
            Payment.objects.select_related(
                "tenant",
                "landlord",
                "property",
                "room",
                "apartment_unit",
                "booking",
            )
            .filter(
                status="success",
                booking__status="payment_completed",
            )
            .order_by(
                "-verified_at",
                "-created_at",
            )
        )

        # Limits regular owners to payments belonging to them.
        if not (
            user.is_superuser
            or role == "admin"
        ):
            payments = payments.filter(
                landlord=user
            )

        # Excludes payments whose bookings already have leases.
        payments = payments.exclude(
            booking__tenant_lease__isnull=False
        )

        results = []

        for payment in payments:
            property_obj = payment.property
            room_obj = payment.room
            apartment_unit_obj = payment.apartment_unit

            # Uses the amount actually paid to preserve the agreed rent even
            # if the property, room, or unit price changes after payment.
            monthly_rent = (
                payment.amount
                / Decimal(str(payment.duration_months))
            ).quantize(Decimal("0.01"))

            tenant_name = (
                payment.tenant.get_full_name()
                or payment.tenant.username
                or payment.tenant.email
            )

            results.append(
                {
                    "payment_id": payment.id,
                    "booking_id": payment.booking_id,
                    "tenant_id": payment.tenant_id,
                    "tenant_name": tenant_name,
                    "tenant_email": payment.tenant.email,
                    "property_id": property_obj.id,
                    "property_name": (
                        property_obj.property_name
                    ),
                    "property_category": (
                        property_obj.category
                    ),
                    "apartment_listing_type": (
                        property_obj.apartment_listing_type
                    ),
                    "room_id": (
                        room_obj.id
                        if room_obj
                        else None
                    ),
                    "room_number": (
                        room_obj.room_number
                        if room_obj
                        else None
                    ),
                    "apartment_unit_id": (
                        apartment_unit_obj.id
                        if apartment_unit_obj
                        else None
                    ),
                    "apartment_unit_number": (
                        apartment_unit_obj.unit_number
                        if apartment_unit_obj
                        else None
                    ),
                    "apartment_unit_floor": (
                        apartment_unit_obj.floor
                        if apartment_unit_obj
                        else None
                    ),
                    "apartment_unit_status": (
                        apartment_unit_obj.status
                        if apartment_unit_obj
                        else None
                    ),
                    "duration_months": (
                        payment.duration_months
                    ),
                    "monthly_rent": str(monthly_rent),
                    "amount_paid": str(payment.amount),
                    "payment_method": (
                        payment.payment_method
                    ),
                    "payment_type": (
                        payment.payment_type
                    ),
                    "payment_date": (
                        payment.verified_at
                        or payment.created_at
                    ),
                    "booking_status": (
                        payment.booking.status
                    ),
                }
            )

        return Response(
            results,
            status=status.HTTP_200_OK,
        )


class CreateLeaseFromPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, payment_id):
        # Validates landlord-controlled lease preparation fields.
        serializer = CreateLeaseFromPaymentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user_role = getattr(user, "role", None)

        # Restricts lease creation to owners and administrators.
        if not (
            user.is_superuser
            or user_role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only property owners can create leases."
            )

        lease_start_date = serializer.validated_data[
            "lease_start_date"
        ]
        move_in_date = serializer.validated_data[
            "move_in_date"
        ]
        deposit_amount = serializer.validated_data[
            "deposit_amount"
        ]
        notes = serializer.validated_data["notes"]

        with transaction.atomic():
            try:
                # Locks the successful payment that authorizes this lease.
                payment = (
                    Payment.objects.select_for_update()
                    .select_related(
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                        "apartment_unit",
                        "booking",
                    )
                    .get(
                        id=payment_id,
                        status="success",
                    )
                )
            except Payment.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "Successful payment not found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # First-time lease creation must be backed by a booking payment,
            # not a lease-renewal payment.
            if not payment.booking_id or payment.renewal_request_id:
                return Response(
                    {
                        "detail": (
                            "This payment cannot be used for "
                            "first-time lease creation."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents an owner from using another owner's payment.
            if not (
                user.is_superuser
                or user_role == "admin"
                or payment.landlord_id == user.id
            ):
                return Response(
                    {
                        "detail": (
                            "You cannot create a lease from "
                            "another owner's payment."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            try:
                # Locks the booking while converting it into a lease.
                booking = (
                    Booking.objects.select_for_update()
                    .get(pk=payment.booking_id)
                )
            except Booking.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "The booking linked to this payment "
                            "could not be found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Allows lease creation only from the awaiting-lease stage.
            if booking.status != "payment_completed":
                return Response(
                    {
                        "detail": (
                            "This booking is not awaiting "
                            "lease creation."
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

            try:
                # Locks the property during lease creation.
                property_obj = (
                    Property.objects.select_for_update()
                    .get(id=payment.property_id)
                )
            except Property.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "The property linked to this payment "
                            "could not be found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Confirms payment, booking, and owner relationships are intact.
            if booking.property_id != property_obj.id:
                return Response(
                    {
                        "detail": (
                            "The payment property no longer matches "
                            "the booking property."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if booking.tenant_id != payment.tenant_id:
                return Response(
                    {
                        "detail": (
                            "The payment tenant no longer matches "
                            "the booking tenant."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if booking.owner_id != payment.landlord_id:
                return Response(
                    {
                        "detail": (
                            "The payment landlord no longer matches "
                            "the booking owner."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if property_obj.owner_id != payment.landlord_id:
                return Response(
                    {
                        "detail": (
                            "The payment landlord does not match "
                            "the property owner."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            room_obj = None
            apartment_unit_obj = None

            if property_obj.category == "hostel":
                # Hostel payments must contain only the reserved room.
                if not payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "This hostel payment has no "
                                "reserved room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if payment.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "A hostel payment cannot contain "
                                "an apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    # Locks the reserved hostel room.
                    room_obj = (
                        Room.objects.select_for_update()
                        .get(
                            id=payment.room_id,
                            property=property_obj,
                        )
                    )
                except Room.DoesNotExist:
                    return Response(
                        {
                            "detail": (
                                "The reserved hostel room "
                                "could not be found."
                            )
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if room_obj.reserved_spaces <= 0:
                    return Response(
                        {
                            "detail": (
                                "This room no longer has a reserved "
                                "space for this payment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Converts one reserved hostel space into occupancy.
                room_obj.reserved_spaces -= 1
                room_obj.occupied_spaces += 1

                # Updates room availability based on remaining capacity.
                room_obj.is_available = (
                    room_obj.available_spaces() > 0
                )

                room_obj.save(
                    update_fields=[
                        "reserved_spaces",
                        "occupied_spaces",
                        "is_available",
                        "updated_at",
                    ]
                )

            elif (
                property_obj.category == "apartment"
                and property_obj.apartment_listing_type == "multi_unit"
            ):
                # Multi-unit payments must contain only the exact reserved
                # apartment unit selected and paid for by the tenant.
                if not payment.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "This apartment payment has no "
                                "reserved apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "A multi-unit apartment payment cannot "
                                "contain a hostel room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    apartment_unit_obj = (
                        ApartmentUnit.objects.select_for_update()
                        .get(
                            id=payment.apartment_unit_id,
                            property=property_obj,
                        )
                    )
                except ApartmentUnit.DoesNotExist:
                    return Response(
                        {
                            "detail": (
                                "The reserved apartment unit "
                                "could not be found."
                            )
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if apartment_unit_obj.status != "reserved":
                    return Response(
                        {
                            "detail": (
                                "This apartment unit is no longer "
                                "reserved for this payment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if TenantLease.objects.filter(
                    apartment_unit=apartment_unit_obj,
                    status="active",
                ).exists():
                    return Response(
                        {
                            "detail": (
                                "This apartment unit already has "
                                "an active lease."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                # Converts the paid reservation into active occupancy.
                apartment_unit_obj.status = "occupied"
                apartment_unit_obj.save()

            else:
                # Houses and single apartments are represented directly by
                # the parent Property and must not contain child resources.
                if payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "This payment cannot contain "
                                "a hostel room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if payment.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "This payment cannot contain "
                                "an apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if TenantLease.objects.filter(
                    property=property_obj,
                    status="active",
                ).exists():
                    return Response(
                        {
                            "detail": (
                                "This property already has "
                                "an active lease."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                # Payment verification already reserved the parent rental.
                # Keep it unavailable while the lease remains active.
                if property_obj.is_available:
                    property_obj.is_available = False
                    property_obj.save(
                        update_fields=[
                            "is_available",
                        ]
                    )

            # Uses the trusted paid amount rather than a price that may have
            # changed after payment initialization.
            if payment.duration_months <= 0:
                return Response(
                    {
                        "detail": (
                            "The payment rental duration is invalid."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            monthly_rent = (
                payment.amount
                / Decimal(str(payment.duration_months))
            ).quantize(Decimal("0.01"))

            # Calculates the lease end date from the paid duration.
            lease_end_date = (
                lease_start_date
                + relativedelta(
                    months=payment.duration_months
                )
            )

            # Creates the active lease from trusted payment data.
            lease = TenantLease.objects.create(
                booking=booking,
                property=property_obj,
                tenant_id=payment.tenant_id,
                landlord_id=payment.landlord_id,
                room=room_obj,
                apartment_unit=apartment_unit_obj,
                lease_start_date=lease_start_date,
                lease_end_date=lease_end_date,
                move_in_date=move_in_date,
                monthly_rent=monthly_rent,
                deposit_amount=deposit_amount,
                first_payment_status="paid",
                notes=(
                    notes
                    or (
                        f"Lease created from payment "
                        f"{payment.reference}."
                    )
                ),
                status="active",
            )

            # Marks the booking as fully converted into a lease.
            booking.status = "converted"
            booking.save(
                update_fields=[
                    "status",
                ]
            )

        try:
            # Notifies the tenant after successful lease creation.
            send_notification(
                user=lease.tenant,
                message=(
                    f"Your lease for "
                    f"{property_obj.property_name} "
                    f"has been created successfully."
                ),
                notification_type="property_booked",
                property_id=property_obj.id,
            )
        except Exception as exc:
            print(
                "LEASE CREATION NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            TenantLeaseSerializer(
                lease,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )