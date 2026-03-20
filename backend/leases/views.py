from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from .models import TenantLease
from .serializers import TenantLeaseSerializer
from notifications.models import Notification


class TenantLeaseViewSet(viewsets.ModelViewSet):
    serializer_class = TenantLeaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return TenantLease.objects.filter(landlord=user).order_by("-id")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = serializer.validated_data.get("booking")
        property_obj = serializer.validated_data.get("property")
        tenant = serializer.validated_data.get("tenant")

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

        existing_active_lease = TenantLease.objects.filter(
            property=property_obj,
            status="active"
        ).exists()

        if existing_active_lease:
            return Response(
                {"detail": "This property already has an active tenant lease."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lease = serializer.save(
            landlord=request.user,
            status="active"
        )

        property_obj.is_available = False
        property_obj.save()

        if booking:
            booking.status = "converted"
            booking.save()

        Notification.objects.create(
            recipient=tenant,
            sender=request.user,
            title="Lease Confirmed",
            message=f"You have been assigned to {property_obj.property_name}.",
            notification_type="meeting",
            link="/dashboard/tenant",
        )

        return Response(
            TenantLeaseSerializer(lease).data,
            status=status.HTTP_201_CREATED
        )