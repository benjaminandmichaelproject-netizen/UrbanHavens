from dateutil.relativedelta import relativedelta
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import send_notification
from payments.models import Payment
from properties.models import Property, Room

from .models import TenantLease
from .serializers import (
    CreateLeaseFromPaymentSerializer,
    TenantLeaseSerializer,
)


class AwaitingLeaseListView(generics.ListAPIView):
    # Returns successful payments that are waiting for lease creation.
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

        # Loads successful payments whose booking awaits lease creation.
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
            .order_by("-verified_at", "-created_at")
        )

        # Limits owners to payments belonging to their properties.
        if not (user.is_superuser or role == "admin"):
            payments = payments.filter(landlord=user)

        # Excludes any payment whose booking already has a lease.
        payments = payments.exclude(
            booking__tenant_lease__isnull=False
        )

        results = []

        for payment in payments:
            property_obj = payment.property
            room_obj = payment.room

            # Builds a safe response for the awaiting-lease dashboard.
            results.append(
                {
                    "payment_id": payment.id,
                    "booking_id": payment.booking_id,
                    "tenant_id": payment.tenant_id,
                    "tenant_name": (
                        payment.tenant.get_full_name()
                        or payment.tenant.username
                        or payment.tenant.email
                    ),
                    "tenant_email": payment.tenant.email,
                    "property_id": property_obj.id,
                    "property_name": property_obj.property_name,
                    "property_category": property_obj.category,
                    "room_id": room_obj.id if room_obj else None,
                    "room_number": (
                        room_obj.room_number
                        if room_obj
                        else None
                    ),
                    "duration_months": payment.duration_months,
                    "monthly_rent": str(
                        room_obj.price_override
                        if (
                            room_obj
                            and room_obj.price_override is not None
                        )
                        else property_obj.price
                    ),
                    "amount_paid": str(payment.amount),
                    "payment_method": payment.payment_method,
                    "payment_type": payment.payment_type,
                    "payment_date": (
                        payment.verified_at
                        or payment.created_at
                    ),
                    "booking_status": payment.booking.status,
                }
            )

        return Response(results, status=status.HTTP_200_OK)


class CreateLeaseFromPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, payment_id):
        # Validates only landlord-controlled lease preparation fields.
        serializer = CreateLeaseFromPaymentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user = request.user

        # Restricts lease creation to owners and administrators.
        if not (
            user.is_superuser
            or getattr(user, "role", None) in [
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
                # Locks the payment and related records against duplicates.
                payment = (
                    Payment.objects.select_for_update()
                    .select_related(
                        "booking",
                        "tenant",
                        "landlord",
                        "property",
                        "room",
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

            # Prevents an owner from using another owner's payment.
            if not (
                user.is_superuser
                or getattr(user, "role", None) == "admin"
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

            booking = payment.booking

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

            # Prevents duplicate lease creation for the same booking.
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

            property_obj = (
                Property.objects.select_for_update()
                .get(id=payment.property_id)
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

                # Locks the reserved room before converting its space.
                room_obj = (
                    Room.objects.select_for_update()
                    .get(id=payment.room_id)
                )

                if room_obj.property_id != property_obj.id:
                    return Response(
                        {
                            "detail": (
                                "The reserved room does not belong "
                                "to this hostel."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if room_obj.reserved_spaces <= 0:
                    return Response(
                        {
                            "detail": (
                                "This room no longer has a reserved "
                                "space for the payment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Converts one reservation into one occupied hostel space.
                room_obj.reserved_spaces -= 1
                room_obj.occupied_spaces += 1
                room_obj.save(
                    update_fields=[
                        "reserved_spaces",
                        "occupied_spaces",
                        "is_available",
                        "updated_at",
                    ]
                )

            else:
                # Ensures house leases cannot receive hostel rooms.
                if payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "House payments cannot contain "
                                "a room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Keeps the reserved house unavailable after conversion.
                if property_obj.is_available:
                    property_obj.is_available = False
                    property_obj.save(
                        update_fields=["is_available"]
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

            # Creates the active lease from server-controlled payment data.
            lease = TenantLease.objects.create(
                booking=booking,
                property=property_obj,
                tenant=payment.tenant,
                landlord=payment.landlord,
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
            booking.save(update_fields=["status"])

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

        # Returns the newly created lease.
        return Response(
            TenantLeaseSerializer(
                lease,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )