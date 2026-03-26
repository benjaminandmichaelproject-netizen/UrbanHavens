from django.db import transaction
from django.db.models import Sum
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import TenantLease
from .serializers import TenantLeaseSerializer
from notifications.utils import send_notification


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
            )
            .prefetch_related("property__images", "property__rooms")
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
            and (user.is_superuser or getattr(user, "role", None) == "admin")
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

    def _sync_house_property_availability(self, property_obj):
        active_exists = TenantLease.objects.filter(
            property=property_obj,
            status="active",
        ).exists()
        property_obj.is_available = not active_exists
        property_obj.save(update_fields=["is_available"])

    @action(detail=False, methods=["get"], url_path="my-lease")
    def my_lease(self, request):
        lease = (
            TenantLease.objects.filter(tenant=request.user, status="active")
            .select_related("property", "tenant", "landlord", "room")
            .prefetch_related("property__images", "property__rooms")
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
                {"detail": "Only the property owner can terminate this lease."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if lease.status != "active":
            return Response(
                {"detail": f"This lease is already {lease.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        move_out_note = request.data.get("note", "").strip()
        property_obj = lease.property

        with transaction.atomic():
            lease.status = "ended"
            if move_out_note:
                existing = lease.notes or ""
                lease.notes = f"{existing}\n[Move-out] {move_out_note}".strip()
            lease.save(update_fields=["status", "notes"])

            if property_obj.category == "hostel":
                room_obj = lease.room
                if room_obj and room_obj.occupied_spaces > 0:
                    room_obj.occupied_spaces -= 1
                    room_obj.save()
            else:
                self._sync_house_property_availability(property_obj)

        send_notification(
            user=lease.tenant,
            message=(
                f"Your lease for {property_obj.property_name} has been ended by the landlord. "
                f"We hope you had a great stay."
            ),
            notification_type="lease_ended",
            property_id=property_obj.id,
        )

        serializer = self.get_serializer(lease)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="renew")
    def renew(self, request, pk=None):
        old_lease = self.get_object()
        user = request.user

        if old_lease.landlord != user and not self._is_admin(user):
            return Response(
                {"detail": "Only the property owner can renew this lease."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if old_lease.status not in ("ended", "cancelled"):
            return Response(
                {"detail": "Only ended or cancelled leases can be renewed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj = old_lease.property
        room_obj = old_lease.room

        payload = {
            "property": property_obj.id,
            "room": room_obj.id if room_obj else None,
            "booking": None,
            "lease_start_date": request.data.get("lease_start_date"),
            "lease_end_date": request.data.get("lease_end_date"),
            "move_in_date": request.data.get("move_in_date"),
            "monthly_rent": request.data.get("monthly_rent", old_lease.monthly_rent),
            "deposit_amount": request.data.get("deposit_amount", old_lease.deposit_amount),
            "first_payment_status": request.data.get("first_payment_status", "pending"),
            "notes": request.data.get("notes", "") or f"Renewal of lease #{old_lease.id}",
        }

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if property_obj.category == "hostel":
                if not room_obj:
                    return Response(
                        {"detail": "Cannot renew hostel lease without an assigned room."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if room_obj.available_spaces() <= 0:
                    return Response(
                        {"detail": "This room is already full."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                room_obj.occupied_spaces += 1
                room_obj.save()

            else:
                active_exists = TenantLease.objects.filter(
                    property=property_obj,
                    status="active",
                ).exists()
                if active_exists:
                    return Response(
                        {"detail": "This property already has an active lease."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            new_lease = serializer.save(
                tenant=old_lease.tenant,
                landlord=old_lease.landlord,
                status="active",
            )

            if property_obj.category == "house_rent":
                property_obj.is_available = False
                property_obj.save(update_fields=["is_available"])

        send_notification(
            user=old_lease.tenant,
            message=(
                f"Your lease for {property_obj.property_name} has been renewed. "
                f"New lease period: {new_lease.lease_start_date} to {new_lease.lease_end_date}."
            ),
            notification_type="lease_renewed",
            property_id=property_obj.id,
        )

        return Response(
            self.get_serializer(new_lease).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="owner-stats")
    def owner_stats(self, request):
        user = request.user
        role = getattr(user, "role", None)

        if not (user.is_superuser or role in ("owner", "admin")):
            return Response(
                {"detail": "Not authorized."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_superuser or role == "admin":
            leases = TenantLease.objects.filter(status="active").select_related("property", "room")
        else:
            leases = TenantLease.objects.filter(
                landlord=user,
                status="active",
            ).select_related("property", "room")

        total_active_leases = leases.count()
        total_revenue = leases.aggregate(total=Sum("monthly_rent"))["total"] or 0

        hostel_properties = {}
        for lease in leases.filter(property__category="hostel"):
            prop = lease.property
            if prop.id not in hostel_properties:
                rooms = list(prop.rooms.all())
                total_rooms = len(rooms)
                total_capacity = sum(room.max_capacity for room in rooms)
                total_occupied = sum(room.occupied_spaces for room in rooms)
                hostel_properties[prop.id] = {
                    "id": prop.id,
                    "property_name": prop.property_name,
                    "total_rooms": total_rooms,
                    "total_capacity": total_capacity,
                    "occupied_spaces": total_occupied,
                    "available_spaces": max(total_capacity - total_occupied, 0),
                    "monthly_revenue": 0,
                }

            hostel_properties[prop.id]["monthly_revenue"] += float(lease.monthly_rent)

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

        if not self._can_manage_property_lease(request.user, property_obj):
            return Response(
                {"detail": "You can only create leases for your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking:
            if booking.property_id != property_obj.id:
                return Response(
                    {"detail": "Selected property does not match the booking property."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if TenantLease.objects.filter(booking=booking, status="active").exists():
                return Response(
                    {"detail": "An active lease already exists for this booking."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            if property_obj.category == "hostel":
                if not room_obj:
                    return Response(
                        {"detail": "A room is required for hostel leases."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if room_obj.property_id != property_obj.id:
                    return Response(
                        {"detail": "Selected room does not belong to this hostel property."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if room_obj.available_spaces() <= 0:
                    return Response(
                        {"detail": "This room is already full."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                room_obj.occupied_spaces += 1
                room_obj.save()

            else:
                active_exists = TenantLease.objects.filter(
                    property=property_obj,
                    status="active",
                ).exists()

                if active_exists or not property_obj.is_available:
                    return Response(
                        {"detail": "This property already has an active tenant lease."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if booking:
                TenantLease.objects.filter(booking=booking).update(booking=None)

            lease = serializer.save(
                tenant=booking.tenant if booking else None,
                landlord=request.user,
                status="active",
            )

            if lease.tenant is None:
                return Response(
                    {"detail": "Lease tenant could not be resolved. Attach a valid booking or set tenant in serializer logic."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if property_obj.category == "house_rent":
                property_obj.is_available = False
                property_obj.save(update_fields=["is_available"])

            if booking:
                booking.status = "converted"
                booking.save(update_fields=["status"])

        send_notification(
            user=lease.tenant,
            message=(
                f"Your lease for {property_obj.property_name} has been confirmed. "
                f"You are now a tenant."
            ),
            notification_type="property_booked",
            property_id=property_obj.id,
        )

        return Response(
            self.get_serializer(lease).data,
            status=status.HTTP_201_CREATED,
        )