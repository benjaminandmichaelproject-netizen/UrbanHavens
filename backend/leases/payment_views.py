from dateutil.relativedelta import relativedelta
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from notifications.utils import send_notification
from payments.models import Payment
from properties.models import Property, Room

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

            # Uses the room price override for hostels when available.
            monthly_rent = (
                room_obj.price_override
                if (
                    room_obj
                    and room_obj.price_override is not None
                )
                else property_obj.price
            )

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
                # Locks only the payment row.
                # Nullable related records are locked separately.
                payment = (
                    Payment.objects.select_for_update()
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

            # Confirms that the payment owner matches the property owner.
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

            if property_obj.category == "hostel":
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

            else:
                # Prevents a house payment from containing a room.
                if payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "House payments cannot contain "
                                "a hostel room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Keeps the reserved house unavailable.
                if property_obj.is_available:
                    property_obj.is_available = False
                    property_obj.save(
                        update_fields=[
                            "is_available",
                        ]
                    )

            monthly_rent = (
                room_obj.price_override
                if (
                    room_obj
                    and room_obj.price_override is not None
                )
                else property_obj.price
            )

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