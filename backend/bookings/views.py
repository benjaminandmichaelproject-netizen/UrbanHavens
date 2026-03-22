from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Booking, InspectionMeeting
from .serializers import BookingSerializer, InspectionMeetingSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        if self.action == "my_owner_bookings":
            return Booking.objects.filter(owner=user).order_by("-id")

        if self.action == "my_tenant_bookings":
            return Booking.objects.filter(tenant=user).order_by("-id")

        if self.action == "list":
            if user.is_superuser or role == "admin":
                return Booking.objects.all().order_by("-id")
            return Booking.objects.filter(tenant=user).order_by("-id")

        if self.action in ["retrieve", "update", "partial_update", "destroy"]:
            if user.is_superuser or role == "admin":
                return Booking.objects.all().order_by("-id")
            return (
                Booking.objects.filter(tenant=user).order_by("-id")
                | Booking.objects.filter(owner=user).order_by("-id")
            )

        return Booking.objects.none()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"])
    def my_owner_bookings(self, request):
        bookings = Booking.objects.filter(owner=request.user).order_by("-id")
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_tenant_bookings(self, request):
        bookings = Booking.objects.filter(tenant=request.user).order_by("-id")
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)


class InspectionMeetingViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionMeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        # Admins see all meetings
        if user.is_superuser or role == "admin":
            return InspectionMeeting.objects.select_related(
                "booking__property", "booking__tenant", "booking__owner"
            ).order_by("-id")

        # Owners see meetings for their bookings
        if role == "owner":
            return InspectionMeeting.objects.filter(
                booking__owner=user
            ).select_related(
                "booking__property", "booking__tenant", "booking__owner"
            ).order_by("-id")

        # Tenants see meetings for their bookings
        return InspectionMeeting.objects.filter(
            booking__tenant=user
        ).select_related(
            "booking__property", "booking__tenant", "booking__owner"
        ).order_by("-id")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Owner can cancel a scheduled meeting."""
        meeting = self.get_object()
        user = request.user

        if user.id != meeting.booking.owner_id:
            if not (user.is_superuser or getattr(user, "role", None) == "admin"):
                return Response(
                    {"detail": "Only the property owner can cancel this meeting."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if meeting.status == "cancelled":
            return Response(
                {"detail": "This meeting is already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        meeting.status = "cancelled"
        meeting.save()

        from notifications.utils import send_notification
        send_notification(
            user=meeting.booking.tenant,
            message=(
                f"Your inspection meeting for "
                f"{meeting.booking.property.property_name} has been cancelled."
            ),
            notification_type="meeting_cancelled",
            property_id=meeting.booking.property.id,
        )

        serializer = self.get_serializer(meeting)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Owner marks a meeting as completed."""
        meeting = self.get_object()
        user = request.user

        if user.id != meeting.booking.owner_id:
            if not (user.is_superuser or getattr(user, "role", None) == "admin"):
                return Response(
                    {"detail": "Only the property owner can mark this meeting as completed."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if meeting.status != "upcoming":
            return Response(
                {"detail": "Only upcoming meetings can be marked as completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        meeting.status = "completed"
        meeting.save()

        serializer = self.get_serializer(meeting)
        return Response(serializer.data, status=status.HTTP_200_OK)