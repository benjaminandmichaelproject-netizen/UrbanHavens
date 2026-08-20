from django.db import transaction
from django.db.models import Sum
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from bookings.models import Booking
from notifications.utils import send_notification
from payments.models import Payment
from properties.models import ApartmentUnit, Property, Room

from .models import TenantLease
from .serializers import TenantLeaseSerializer


class TenantLeaseViewSet(viewsets.ModelViewSet):
    serializer_class = TenantLeaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        base_qs = (
            TenantLease.objects.select_related(
                "property",
                "tenant",
                "landlord",
                "room",
                "apartment_unit",
            )
            .prefetch_related(
                "property__images",
                "property__rooms",
                "property__apartment_units",
            )
            .order_by("-id")
        )

        if user.is_superuser or role == "admin":
            return base_qs

        if role == "owner":
            return base_qs.filter(landlord=user)

        return base_qs.filter(tenant=user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or getattr(user, "role", None) == "admin"
            )
        )

    def _can_manage_property_lease(self, user, property_obj):
        if self._is_admin(user):
            return True

        return bool(
            user
            and user.is_authenticated
            and property_obj.owner_id
            and property_obj.owner_id == user.id
        )

    # Synchronizes availability for rentals represented directly by Property.
    def _sync_parent_property_availability(self, property_obj):
        active_exists = TenantLease.objects.filter(
            property=property_obj,
            status="active",
        ).exists()

        property_obj.is_available = not active_exists
        property_obj.save(update_fields=["is_available"])

    # Returns a readable resource label for notifications and responses.
    def _resource_label(self, lease):
        if lease.room:
            return f"Room {lease.room.room_number}"

        if lease.apartment_unit:
            return f"Unit {lease.apartment_unit.unit_number}"

        return lease.property.property_name

    @action(detail=False, methods=["get"], url_path="my-lease")
    def my_lease(self, request):
        lease = (
            TenantLease.objects.filter(
                tenant=request.user,
                status="active",
            )
            .select_related(
                "property",
                "tenant",
                "landlord",
                "room",
                "apartment_unit",
            )
            .prefetch_related(
                "property__images",
                "property__rooms",
                "property__apartment_units",
            )
            .first()
        )

        if not lease:
            return Response(None, status=status.HTTP_200_OK)

        serializer = self.get_serializer(lease)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="terminate")
    def terminate(self, request, pk=None):
        lease = self.get_object()
        user = request.user

        if lease.landlord != user and not self._is_admin(user):
            return Response(
                {
                    "detail": (
                        "Only the property owner can terminate this lease."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if lease.status != "active":
            return Response(
                {
                    "detail": (
                        f"This lease is already {lease.status}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        move_out_note = request.data.get("note", "").strip()

        with transaction.atomic():
            # Locks the lease and related rentable resource before release.
            locked_lease = (
                TenantLease.objects.select_for_update()
                .select_related(
                    "property",
                    "room",
                    "apartment_unit",
                    "tenant",
                )
                .get(pk=lease.pk)
            )

            property_obj = (
                Property.objects.select_for_update()
                .get(pk=locked_lease.property_id)
            )

            locked_lease.status = "ended"

            if move_out_note:
                existing = locked_lease.notes or ""
                locked_lease.notes = (
                    f"{existing}\n[Move-out] {move_out_note}"
                ).strip()

            locked_lease.save(
                update_fields=[
                    "status",
                    "notes",
                ]
            )

            if property_obj.category == "hostel":
                # Releases one occupied hostel space.
                room_obj = None

                if locked_lease.room_id:
                    room_obj = (
                        Room.objects.select_for_update()
                        .filter(
                            pk=locked_lease.room_id,
                            property=property_obj,
                        )
                        .first()
                    )

                if room_obj and room_obj.occupied_spaces > 0:
                    room_obj.occupied_spaces -= 1
                    room_obj.save()

            elif (
                property_obj.category == "apartment"
                and property_obj.apartment_listing_type == "multi_unit"
            ):
                # Releases only the apartment unit attached to this lease.
                apartment_unit = None

                if locked_lease.apartment_unit_id:
                    apartment_unit = (
                        ApartmentUnit.objects.select_for_update()
                        .filter(
                            pk=locked_lease.apartment_unit_id,
                            property=property_obj,
                        )
                        .first()
                    )

                if apartment_unit:
                    another_active_lease = TenantLease.objects.filter(
                        apartment_unit=apartment_unit,
                        status="active",
                    ).exclude(pk=locked_lease.pk).exists()

                    if not another_active_lease:
                        apartment_unit.status = "available"
                        apartment_unit.save()

            else:
                # Houses and single apartments are represented by Property.
                self._sync_parent_property_availability(property_obj)

        send_notification(
            user=locked_lease.tenant,
            message=(
                f"Your lease for {property_obj.property_name} has been "
                f"ended by the landlord. We hope you had a great stay."
            ),
            notification_type="lease_ended",
            property_id=property_obj.id,
        )

        serializer = self.get_serializer(locked_lease)
        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="renew")
    def renew(self, request, pk=None):
        old_lease = self.get_object()
        user = request.user

        if old_lease.landlord != user and not self._is_admin(user):
            return Response(
                {
                    "detail": (
                        "Only the property owner can renew this lease."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if old_lease.status not in ("ended", "cancelled"):
            return Response(
                {
                    "detail": (
                        "Only ended or cancelled leases can be renewed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj = old_lease.property
        room_obj = old_lease.room
        apartment_unit_obj = old_lease.apartment_unit

        payload = {
            "property": property_obj.id,
            "room": room_obj.id if room_obj else None,
            "apartment_unit": (
                apartment_unit_obj.id
                if apartment_unit_obj
                else None
            ),
            "booking": None,
            "lease_start_date": request.data.get("lease_start_date"),
            "lease_end_date": request.data.get("lease_end_date"),
            "move_in_date": request.data.get("move_in_date"),
            "monthly_rent": request.data.get(
                "monthly_rent",
                old_lease.monthly_rent,
            ),
            "deposit_amount": request.data.get(
                "deposit_amount",
                old_lease.deposit_amount,
            ),
            "first_payment_status": request.data.get(
                "first_payment_status",
                "pending",
            ),
            "notes": (
                request.data.get("notes", "")
                or f"Renewal of lease #{old_lease.id}"
            ),
        }

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            locked_property = (
                Property.objects.select_for_update()
                .get(pk=property_obj.pk)
            )

            locked_room = None
            locked_apartment_unit = None

            if locked_property.category == "hostel":
                if not room_obj:
                    return Response(
                        {
                            "detail": (
                                "Cannot renew hostel lease without "
                                "an assigned room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                locked_room = (
                    Room.objects.select_for_update()
                    .filter(
                        pk=room_obj.pk,
                        property=locked_property,
                    )
                    .first()
                )

                if not locked_room:
                    return Response(
                        {
                            "detail": (
                                "The assigned hostel room is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if locked_room.available_spaces() <= 0:
                    return Response(
                        {
                            "detail": "This room is already full."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            elif (
                locked_property.category == "apartment"
                and locked_property.apartment_listing_type == "multi_unit"
            ):
                if not apartment_unit_obj:
                    return Response(
                        {
                            "detail": (
                                "Cannot renew a multi-unit apartment "
                                "lease without its apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                locked_apartment_unit = (
                    ApartmentUnit.objects.select_for_update()
                    .filter(
                        pk=apartment_unit_obj.pk,
                        property=locked_property,
                    )
                    .first()
                )

                if not locked_apartment_unit:
                    return Response(
                        {
                            "detail": (
                                "The assigned apartment unit is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if locked_apartment_unit.status != "available":
                    return Response(
                        {
                            "detail": (
                                "This apartment unit is no longer "
                                "available."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                active_exists = TenantLease.objects.filter(
                    apartment_unit=locked_apartment_unit,
                    status="active",
                ).exists()

                if active_exists:
                    return Response(
                        {
                            "detail": (
                                "This apartment unit already has "
                                "an active lease."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            else:
                active_exists = TenantLease.objects.filter(
                    property=locked_property,
                    status="active",
                ).exists()

                if active_exists:
                    return Response(
                        {
                            "detail": (
                                "This property already has an active lease."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            new_lease = serializer.save(
                tenant=old_lease.tenant,
                landlord=old_lease.landlord,
                property=locked_property,
                room=locked_room,
                apartment_unit=locked_apartment_unit,
                status="active",
            )

            if locked_room:
                locked_room.occupied_spaces += 1
                locked_room.save()

            elif locked_apartment_unit:
                locked_apartment_unit.status = "occupied"
                locked_apartment_unit.save()

            else:
                locked_property.is_available = False
                locked_property.save(
                    update_fields=["is_available"]
                )

        send_notification(
            user=old_lease.tenant,
            message=(
                f"Your lease for {locked_property.property_name} "
                f"has been renewed. New lease period: "
                f"{new_lease.lease_start_date} to "
                f"{new_lease.lease_end_date}."
            ),
            notification_type="lease_renewed",
            property_id=locked_property.id,
        )

        return Response(
            self.get_serializer(new_lease).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="owner-stats")
    def owner_stats(self, request):
        user = request.user
        role = getattr(user, "role", None)

        if not (
            user.is_superuser
            or role in ("owner", "admin")
        ):
            return Response(
                {"detail": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_superuser or role == "admin":
            leases = (
                TenantLease.objects.filter(status="active")
                .select_related(
                    "property",
                    "room",
                    "apartment_unit",
                )
            )
        else:
            leases = (
                TenantLease.objects.filter(
                    landlord=user,
                    status="active",
                )
                .select_related(
                    "property",
                    "room",
                    "apartment_unit",
                )
            )

        total_active_leases = leases.count()
        total_revenue = (
            leases.aggregate(total=Sum("monthly_rent"))["total"]
            or 0
        )

        hostel_properties = {}

        for lease in leases.filter(property__category="hostel"):
            prop = lease.property

            if prop.id not in hostel_properties:
                rooms = list(prop.rooms.all())
                total_rooms = len(rooms)
                total_capacity = sum(
                    room.max_capacity
                    for room in rooms
                )
                total_occupied = sum(
                    room.occupied_spaces
                    for room in rooms
                )

                hostel_properties[prop.id] = {
                    "id": prop.id,
                    "property_name": prop.property_name,
                    "total_rooms": total_rooms,
                    "total_capacity": total_capacity,
                    "occupied_spaces": total_occupied,
                    "available_spaces": max(
                        total_capacity - total_occupied,
                        0,
                    ),
                    "monthly_revenue": 0,
                }

            hostel_properties[prop.id]["monthly_revenue"] += float(
                lease.monthly_rent
            )

        hostel_stats = []

        for item in hostel_properties.values():
            item["full"] = item["available_spaces"] == 0
            hostel_stats.append(item)

        return Response(
            {
                "total_active_leases": total_active_leases,
                "total_monthly_revenue": float(total_revenue),
                "hostel_stats": hostel_stats,
            }
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = serializer.validated_data.get("booking")
        property_obj = serializer.validated_data.get("property")
        room_obj = serializer.validated_data.get("room")
        apartment_unit_obj = serializer.validated_data.get(
            "apartment_unit"
        )

        if not self._can_manage_property_lease(
            request.user,
            property_obj,
        ):
            return Response(
                {
                    "detail": (
                        "You can only create leases for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Tenant is derived from the booking in the existing lease workflow.
        if not booking:
            return Response(
                {
                    "detail": (
                        "A valid booking is required to create a lease."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.property_id != property_obj.id:
            return Response(
                {
                    "detail": (
                        "Selected property does not match "
                        "the booking property."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Locks the booking and its successful payment so the exact
            # paid rentable resource cannot change during lease creation.
            locked_booking = (
                Booking.objects.select_for_update()
                .select_related(
                    "property",
                    "tenant",
                    "owner",
                )
                .get(pk=booking.pk)
            )

            try:
                payment = (
                    Payment.objects.select_for_update()
                    .select_related(
                        "room",
                        "apartment_unit",
                    )
                    .get(
                        booking=locked_booking,
                        status="success",
                    )
                )
            except Payment.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "A successful payment is required before "
                            "creating this lease."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            locked_property = (
                Property.objects.select_for_update()
                .get(pk=property_obj.pk)
            )

            if payment.property_id != locked_property.id:
                return Response(
                    {
                        "detail": (
                            "The successful payment does not belong "
                            "to this property."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents duplicate lease creation for the same booking.
            if TenantLease.objects.filter(
                booking=locked_booking,
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

            locked_room = None
            locked_apartment_unit = None

            if locked_property.category == "hostel":
                if not payment.room_id:
                    return Response(
                        {
                            "detail": (
                                "The successful hostel payment does "
                                "not have a room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                locked_room = (
                    Room.objects.select_for_update()
                    .filter(
                        pk=payment.room_id,
                        property=locked_property,
                    )
                    .first()
                )

                if not locked_room:
                    return Response(
                        {
                            "detail": (
                                "The selected hostel room is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Payment verification reserves one hostel space. Lease
                # activation consumes that reservation into occupancy.
                if locked_room.reserved_spaces <= 0:
                    return Response(
                        {
                            "detail": (
                                "This hostel room no longer has a "
                                "reserved space for this payment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            elif (
                locked_property.category == "apartment"
                and locked_property.apartment_listing_type == "multi_unit"
            ):
                if not payment.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "The successful apartment payment does "
                                "not have an apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                locked_apartment_unit = (
                    ApartmentUnit.objects.select_for_update()
                    .filter(
                        pk=payment.apartment_unit_id,
                        property=locked_property,
                    )
                    .first()
                )

                if not locked_apartment_unit:
                    return Response(
                        {
                            "detail": (
                                "The selected apartment unit is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if locked_apartment_unit.status != "reserved":
                    return Response(
                        {
                            "detail": (
                                "This apartment unit is no longer "
                                "reserved for lease creation."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Prevents a unit from receiving two active leases.
                if TenantLease.objects.filter(
                    apartment_unit=locked_apartment_unit,
                    status="active",
                ).exists():
                    return Response(
                        {
                            "detail": (
                                "This apartment unit already has "
                                "an active lease."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            else:
                # Houses and single apartments use the parent Property.
                if TenantLease.objects.filter(
                    property=locked_property,
                    status="active",
                ).exists():
                    return Response(
                        {
                            "detail": (
                                "This property already has "
                                "an active tenant lease."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Clears any older non-active lease that still owns the booking
            # relation before creating the new active lease.
            TenantLease.objects.filter(
                booking=locked_booking
            ).update(
                booking=None
            )

            lease = serializer.save(
                booking=locked_booking,
                property=locked_property,
                tenant=locked_booking.tenant,
                landlord=request.user,
                room=locked_room,
                apartment_unit=locked_apartment_unit,
                status="active",
            )

            # Converts the payment reservation into active occupancy.
            if locked_room:
                locked_room.reserved_spaces -= 1
                locked_room.occupied_spaces += 1
                locked_room.save()

            elif locked_apartment_unit:
                locked_apartment_unit.status = "occupied"
                locked_apartment_unit.save()

            else:
                # Payment verification already reserved the parent rental;
                # keep it unavailable while the lease is active.
                locked_property.is_available = False
                locked_property.save(
                    update_fields=["is_available"]
                )

            locked_booking.status = "converted"
            locked_booking.save(
                update_fields=["status"]
            )

        send_notification(
            user=lease.tenant,
            message=(
                f"Your lease for {locked_property.property_name} "
                f"has been confirmed. You are now a tenant."
            ),
            notification_type="property_booked",
            property_id=locked_property.id,
        )

        return Response(
            self.get_serializer(lease).data,
            status=status.HTTP_201_CREATED,
        )