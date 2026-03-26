from django.db.models import Q
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

        queryset = Booking.objects.select_related(
            "property",
            "tenant",
            "owner",
        ).prefetch_related("property__images")

        if user.is_superuser or role == "admin":
            return queryset.order_by("-id")

        if self.action == "my_owner_bookings":
            return queryset.filter(owner=user, archived_by_owner=False).order_by("-id")

        if self.action == "my_tenant_bookings":
            return queryset.filter(tenant=user, archived_by_tenant=False).order_by("-id")

        if self.action == "list":
            return queryset.filter(tenant=user, archived_by_tenant=False).order_by("-id")

        if self.action in [
            "retrieve",
            "update",
            "partial_update",
            "destroy",
            "clear",
            "clear_for_tenant",
        ]:
            return queryset.filter(Q(tenant=user) | Q(owner=user)).order_by("-id")

        return queryset.none()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"])
    def my_owner_bookings(self, request):
        user = request.user
        role = getattr(user, "role", None)

        if not (user.is_superuser or role in ["admin", "owner"]):
            return Response(
                {"detail": "Only property owners can view owner bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        bookings = (
            Booking.objects.select_related("property", "tenant", "owner")
            .prefetch_related("property__images")
            .filter(owner=user, archived_by_owner=False)
            .order_by("-id")
        )
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_tenant_bookings(self, request):
        bookings = (
            Booking.objects.select_related("property", "tenant", "owner")
            .prefetch_related("property__images")
            .filter(tenant=request.user, archived_by_tenant=False)
            .order_by("-id")
        )
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="clear")
    def clear(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        if user.id != booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can clear this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status != "converted":
            return Response(
                {"detail": "Only converted bookings can be cleared."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.archived_by_owner = True
        booking.save(update_fields=["archived_by_owner"])

        return Response(
            {"detail": "Booking cleared from active owner view."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="clear-for-tenant")
    def clear_for_tenant(self, request, pk=None):
        booking = self.get_object()

        if request.user.id != booking.tenant_id:
            return Response(
                {"detail": "Only the tenant can clear this booking from their list."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status != "converted":
            return Response(
                {"detail": "Only converted bookings can be cleared."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.archived_by_tenant = True
        booking.save(update_fields=["archived_by_tenant"])

        return Response(
            {"detail": "Booking cleared from active tenant view."},
            status=status.HTTP_200_OK,
        )


class InspectionMeetingViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionMeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        queryset = InspectionMeeting.objects.select_related(
            "booking__property",
            "booking__tenant",
            "booking__owner"
        ).prefetch_related("booking__property__images")

        if user.is_superuser or role == "admin":
            return queryset.order_by("-id")

        if role == "owner":
            return queryset.filter(booking__owner=user).order_by("-id")

        return queryset.filter(booking__tenant=user).order_by("-id")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        meeting = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        if user.id != meeting.booking.owner_id and not (
            user.is_superuser or role == "admin"
        ):
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
        meeting = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        if user.id != meeting.booking.owner_id and not (
            user.is_superuser or role == "admin"
        ):
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