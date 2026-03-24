from django.db.models import Sum
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import TenantLease
from .serializers import TenantLeaseSerializer
from notifications.utils import send_notification
from bookings.models import Booking


class TenantLeaseViewSet(viewsets.ModelViewSet):
    serializer_class = TenantLeaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        if user.is_superuser or role == "admin":
            return TenantLease.objects.select_related(
                "property", "tenant", "landlord"
            ).order_by("-id")

        if role == "owner":
            return TenantLease.objects.filter(
                landlord=user
            ).select_related("property", "tenant", "landlord").order_by("-id")

        return TenantLease.objects.filter(
            tenant=user
        ).select_related("property", "tenant", "landlord").order_by("-id")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    # ── Tenant: active lease ──────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="my-lease")
    def my_lease(self, request):
        lease = TenantLease.objects.filter(
            tenant=request.user, status="active"
        ).select_related("property", "tenant", "landlord").first()

        if not lease:
            return Response(None, status=status.HTTP_200_OK)

        serializer = self.get_serializer(lease)
        return Response(serializer.data)

    # ── Owner: terminate a lease ──────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="terminate")
    def terminate(self, request, pk=None):
        lease = self.get_object()
        user  = request.user

        if lease.landlord != user:
            if not (user.is_superuser or getattr(user, "role", None) == "admin"):
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

        lease.status = "ended"
        if move_out_note:
            existing = lease.notes or ""
            lease.notes = f"{existing}\n[Move-out] {move_out_note}".strip()
        lease.save()

        property_obj = lease.property

        if property_obj.category == "hostel":
            occupied = TenantLease.objects.filter(
                property=property_obj, status="active"
            ).count()
            if occupied < property_obj.bedrooms:
                property_obj.is_available = True
                property_obj.save()
        else:
            property_obj.is_available = True
            property_obj.save()

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

    # ── Owner: renew an ended lease ───────────────────────────────────
    @action(detail=True, methods=["post"], url_path="renew")
    def renew(self, request, pk=None):
        old_lease = self.get_object()
        user      = request.user

        if old_lease.landlord != user:
            if not (user.is_superuser or getattr(user, "role", None) == "admin"):
                return Response(
                    {"detail": "Only the property owner can renew this lease."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if old_lease.status not in ("ended", "cancelled"):
            return Response(
                {"detail": "Only ended or cancelled leases can be renewed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lease_start_date     = request.data.get("lease_start_date")
        lease_end_date       = request.data.get("lease_end_date")
        move_in_date         = request.data.get("move_in_date")
        monthly_rent         = request.data.get("monthly_rent", old_lease.monthly_rent)
        deposit_amount       = request.data.get("deposit_amount", old_lease.deposit_amount)
        first_payment_status = request.data.get("first_payment_status", "pending")
        notes                = request.data.get("notes", "")
        room_number          = request.data.get("room_number", old_lease.room_number)

        if not lease_start_date:
            return Response({"detail": "lease_start_date is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not lease_end_date:
            return Response({"detail": "lease_end_date is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not move_in_date:
            return Response({"detail": "move_in_date is required."}, status=status.HTTP_400_BAD_REQUEST)
        if lease_end_date <= lease_start_date:
            return Response({"detail": "Lease end date must be after start date."}, status=status.HTTP_400_BAD_REQUEST)

        property_obj = old_lease.property

        if property_obj.category == "hostel":
            occupied = TenantLease.objects.filter(
                property=property_obj, status="active"
            ).count()
            if occupied >= property_obj.bedrooms:
                return Response(
                    {"detail": "All rooms in this hostel are currently occupied."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if TenantLease.objects.filter(property=property_obj, status="active").exists():
                return Response(
                    {"detail": "This property already has an active lease."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        new_lease = TenantLease.objects.create(
            property=property_obj,
            tenant=old_lease.tenant,
            landlord=user,
            booking=None,
            room_number=room_number,
            lease_start_date=lease_start_date,
            lease_end_date=lease_end_date,
            move_in_date=move_in_date,
            monthly_rent=monthly_rent,
            deposit_amount=deposit_amount,
            first_payment_status=first_payment_status,
            notes=notes or f"Renewal of lease #{old_lease.id}",
            status="active",
        )

        if property_obj.category != "hostel":
            property_obj.is_available = False
            property_obj.save()

        send_notification(
            user=old_lease.tenant,
            message=(
                f"Your lease for {property_obj.property_name} has been renewed. "
                f"New lease period: {lease_start_date} to {lease_end_date}."
            ),
            notification_type="lease_renewed",
            property_id=property_obj.id,
        )

        serializer = self.get_serializer(new_lease)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="owner-stats")
    def owner_stats(self, request):
        user = request.user
        role = getattr(user, "role", None)

        if not (user.is_superuser or role in ("owner", "admin")):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        leases = TenantLease.objects.filter(
            landlord=user, status="active"
        ).select_related("property")

        total_active_leases = leases.count()
        total_revenue = leases.aggregate(total=Sum("monthly_rent"))["total"] or 0

        hostel_leases = leases.filter(property__category="hostel")
        hostel_properties = {}
        for lease in hostel_leases:
            prop = lease.property
            if prop.id not in hostel_properties:
                hostel_properties[prop.id] = {
                    "id": prop.id,
                    "property_name": prop.property_name,
                    "total_rooms": prop.bedrooms,
                    "occupied_rooms": 0,
                    "monthly_revenue": 0,
                }
            hostel_properties[prop.id]["occupied_rooms"] += 1
            hostel_properties[prop.id]["monthly_revenue"] += float(lease.monthly_rent)

        hostel_stats = []
        for h in hostel_properties.values():
            h["available_rooms"] = max(0, h["total_rooms"] - h["occupied_rooms"])
            h["full"] = h["available_rooms"] == 0
            hostel_stats.append(h)

        return Response({
            "total_active_leases": total_active_leases,
            "total_monthly_revenue": float(total_revenue),
            "hostel_stats": hostel_stats,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking     = serializer.validated_data.get("booking")
        property_obj = serializer.validated_data.get("property")
        tenant      = serializer.validated_data.get("tenant")

        if property_obj.owner != request.user:
            return Response(
                {"detail": "You can only create leases for your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking:
            if booking.owner != request.user:
                return Response(
                    {"detail": "This booking does not belong to you."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if booking.property != property_obj:
                return Response(
                    {"detail": "Selected property does not match the booking property."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if booking.tenant != tenant:
                return Response(
                    {"detail": "Selected tenant does not match the booking tenant."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ── Block if lease already exists for this booking ─────────
            if TenantLease.objects.filter(booking=booking, status="active").exists():
                return Response(
                    {"detail": "An active lease already exists for this booking."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if property_obj.category == "hostel":
            occupied = TenantLease.objects.filter(
                property=property_obj, status="active"
            ).count()
            if occupied >= property_obj.bedrooms:
                return Response(
                    {"detail": "All rooms in this hostel are currently occupied."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if TenantLease.objects.filter(property=property_obj, status="active").exists():
                return Response(
                    {"detail": "This property already has an active tenant lease."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── Detach booking from any old lease to avoid OneToOneField conflict ──
        if booking:
            TenantLease.objects.filter(booking=booking).update(booking=None)

        lease = serializer.save(landlord=request.user, status="active")

        # ── Mark booking as converted ──────────────────────────────────
        if booking:
            booking.status = "converted"
            booking.save()

        if property_obj.category == "hostel":
            occupied_after_create = TenantLease.objects.filter(
                property=property_obj, status="active"
            ).count()
            property_obj.is_available = occupied_after_create < property_obj.bedrooms
        else:
            property_obj.is_available = False

        property_obj.save()

        send_notification(
            user=tenant,
            message=(
                f"Your lease for {property_obj.property_name} has been confirmed. "
                f"You are now a tenant."
            ),
            notification_type="property_booked",
            property_id=property_obj.id,
        )

        return Response(
            TenantLeaseSerializer(lease, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        serializer.save(landlord=self.request.user, status="active")