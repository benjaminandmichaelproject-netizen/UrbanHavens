import hashlib
import json

from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from system_logs.logger import (
    log_booking_event,
    log_meeting_event,
    log_sms_failure,
    log_sms_success,
)

from .models import Booking, BookingIdempotencyKey, InspectionMeeting
from .serializers import BookingSerializer, InspectionMeetingSerializer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def build_request_hash(data: dict) -> str:
    """
    Produce a stable SHA-256 fingerprint of the incoming request body.

    Keys are sorted before serialisation so that two payloads with the same
    data but different key ordering produce the same hash. This hash is
    stored alongside the idempotency key so we can detect when a client
    reuses a key with a different payload.
    """
    normalized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Booking ViewSet
# ---------------------------------------------------------------------------

class BookingViewSet(viewsets.ModelViewSet):
    """
    Full CRUD viewset for Booking, plus custom actions for owner/tenant
    list views, rejection, confirmation, and archiving (clearing) bookings.
    """

    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ------------------------------------------------------------------
    # Queryset filtering
    # ------------------------------------------------------------------

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
            "reject",
            "confirm",
        ]:
            return queryset.filter(Q(tenant=user) | Q(owner=user)).order_by("-id")

        return queryset.none()

    # ------------------------------------------------------------------
    # Serializer context
    # ------------------------------------------------------------------

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    # ------------------------------------------------------------------
    # Create — with idempotency key support
    # ------------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return Response(
                {"detail": "Idempotency-Key header is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request_hash = build_request_hash(request.data)

        # STEP 1 — check existing key FIRST (no lock)
        existing_key = BookingIdempotencyKey.objects.filter(
            user=request.user,
            key=idempotency_key,
            endpoint="/api/bookings/",
        ).first()

        if existing_key:
            if existing_key.request_hash != request_hash:
                return Response(
                    {"detail": "This Idempotency-Key was already used with a different booking request."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if existing_key.response_body and existing_key.response_status:
                return Response(existing_key.response_body, status=existing_key.response_status)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # STEP 2 — create booking FIRST (short transaction)
        with transaction.atomic():
            booking = serializer.save()

        # STEP 3 — write idempotency key OUTSIDE main transaction
        key_record, _ = BookingIdempotencyKey.objects.get_or_create(
            key=idempotency_key,
            defaults={
                "user": request.user,
                "endpoint": "/api/bookings/",
                "request_hash": request_hash,
            },
        )

        # STEP 4 — store response
        response_serializer = self.get_serializer(booking)
        response_body = response_serializer.data

        key_record.response_status = status.HTTP_201_CREATED
        key_record.response_body = response_body
        key_record.save(update_fields=["response_status", "response_body"])

        # STEP 5 — logging LAST (never block booking)
        log_booking_event(
            message=f"Booking {booking.id} created",
            status="success",
            booking_id=booking.id,
            user=request.user,
            detail=f"New booking for {booking.property.property_name} by {request.user.username}",
        )

        headers = self.get_success_headers(response_body)
        return Response(response_body, status=status.HTTP_201_CREATED, headers=headers)

    # ------------------------------------------------------------------
    # Custom list actions
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Status-change actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        if user.id != booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can confirm this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status == "approved":
            return Response(
                {"detail": "This booking is already confirmed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.status in ["rejected", "converted"]:
            return Response(
                {"detail": "This booking cannot be confirmed in its current state."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = "approved"
        booking.save(update_fields=["status"])

        log_booking_event(
            message=f"Booking {booking.id} confirmed",
            status="success",
            booking_id=booking.id,
            user=request.user,
            detail=f"Booking for {booking.property.property_name} confirmed by {request.user.username}",
        )

        from notifications.utils import send_notification
        from notifications.sms import send_booking_approved_sms

        send_notification(
            user=booking.tenant,
            message=(
                f"Your booking request for {booking.property.property_name} "
                f"has been confirmed."
            ),
            notification_type="booking_confirmed",
            property_id=booking.property.id,
        )

        try:
            send_booking_approved_sms(booking)
            log_sms_success(
                message="Booking confirmation SMS sent successfully",
                phone=booking.tenant.phone or "",
                booking_id=booking.id,
            )
        except Exception as exc:
            log_sms_failure(
                message="Booking confirmation SMS failed",
                phone=booking.tenant.phone or "",
                booking_id=booking.id,
                detail=str(exc),
            )

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        if user.id != booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can reject this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status == "rejected":
            return Response(
                {"detail": "This booking is already rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.status == "converted":
            return Response(
                {"detail": "Converted bookings cannot be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = "rejected"
        booking.save(update_fields=["status"])

        log_booking_event(
            message=f"Booking {booking.id} rejected",
            status="failure",
            booking_id=booking.id,
            user=request.user,
            detail=f"Booking for {booking.property.property_name} rejected by {request.user.username}",
        )

        from notifications.utils import send_notification
        from notifications.sms import send_booking_rejected_sms

        send_notification(
            user=booking.tenant,
            message=(
                f"Your booking request for {booking.property.property_name} "
                f"has been rejected."
            ),
            notification_type="booking_rejected",
            property_id=booking.property.id,
        )

        try:
            send_booking_rejected_sms(booking)
            log_sms_success(
                message="Booking rejection SMS sent successfully",
                phone=booking.tenant.phone or "",
                booking_id=booking.id,
            )
        except Exception as exc:
            log_sms_failure(
                message="Booking rejection SMS failed",
                phone=booking.tenant.phone or "",
                booking_id=booking.id,
                detail=str(exc),
            )

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Archive (clear) actions
    # ------------------------------------------------------------------

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

        log_booking_event(
            message=f"Booking {booking.id} archived by owner",
            status="info",
            booking_id=booking.id,
            user=request.user,
            detail=f"Converted booking for {booking.property.property_name} cleared from owner active list",
        )

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

        log_booking_event(
            message=f"Booking {booking.id} archived by tenant",
            status="info",
            booking_id=booking.id,
            user=request.user,
            detail=f"Converted booking for {booking.property.property_name} cleared from tenant active list",
        )

        return Response(
            {"detail": "Booking cleared from active tenant view."},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Inspection Meeting ViewSet
# ---------------------------------------------------------------------------

class InspectionMeetingViewSet(viewsets.ModelViewSet):
    """
    CRUD viewset for InspectionMeeting, plus custom actions for
    cancelling and completing a meeting.
    """

    serializer_class = InspectionMeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ------------------------------------------------------------------
    # Queryset filtering
    # ------------------------------------------------------------------

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        queryset = InspectionMeeting.objects.select_related(
            "booking__property",
            "booking__tenant",
            "booking__owner",
        ).prefetch_related("booking__property__images")

        if user.is_superuser or role == "admin":
            return queryset.order_by("-id")

        if role == "owner":
            return queryset.filter(booking__owner=user).order_by("-id")

        return queryset.filter(booking__tenant=user).order_by("-id")

    # ------------------------------------------------------------------
    # Serializer context
    # ------------------------------------------------------------------

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        meeting = serializer.save()

        log_meeting_event(
            message=f"Meeting {meeting.id} scheduled",
            status="success",
            meeting_id=meeting.id,
            booking_id=meeting.booking.id,
            user=self.request.user,
            detail=f"{meeting.date} {meeting.time} at {meeting.location}",
        )

    # ------------------------------------------------------------------
    # Status-change actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        meeting = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        if user.id != meeting.booking.owner_id and not (user.is_superuser or role == "admin"):
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

        log_meeting_event(
            message=f"Meeting {meeting.id} cancelled",
            status="failure",
            meeting_id=meeting.id,
            booking_id=meeting.booking.id,
            user=request.user,
            detail=f"Meeting for {meeting.booking.property.property_name} cancelled by {request.user.username}",
        )

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

        if user.id != meeting.booking.owner_id and not (user.is_superuser or role == "admin"):
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

        log_meeting_event(
            message=f"Meeting {meeting.id} completed",
            status="success",
            meeting_id=meeting.id,
            booking_id=meeting.booking.id,
            user=request.user,
            detail=f"Meeting for {meeting.booking.property.property_name} marked completed by {request.user.username}",
        )

        serializer = self.get_serializer(meeting)
        return Response(serializer.data, status=status.HTTP_200_OK)