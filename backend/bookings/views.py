import hashlib
import json

from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Booking, BookingIdempotencyKey, InspectionMeeting
from .serializers import BookingSerializer, InspectionMeetingSerializer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def build_request_hash(data: dict) -> str:
    """
    Produce a stable SHA-256 fingerprint of the incoming request body.

    Keys are sorted before serialisation so that two payloads with the same
    data but different key ordering produce the same hash.  This hash is
    stored alongside the idempotency key so we can detect when a client
    reuses a key with a *different* payload — which is always an error.
    """
    normalized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Booking ViewSet
# ---------------------------------------------------------------------------

class BookingViewSet(viewsets.ModelViewSet):
    """
    Full CRUD viewset for Booking, plus custom actions for owner/tenant
    list views, rejection, and archiving (clearing) bookings.

    Access is gated per-action in get_queryset() so that tenants can only
    see their own bookings and owners can only see bookings on their
    properties — unless the user is an admin/superuser.
    """

    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ------------------------------------------------------------------
    # Queryset filtering
    # ------------------------------------------------------------------

    def get_queryset(self):
        """
        Return the appropriate queryset based on who is making the request
        and which action is being performed.

        - Admins and superusers see all bookings.
        - my_owner_bookings  → bookings where the requester is the property owner.
        - my_tenant_bookings → bookings where the requester is the tenant.
        - list               → same as my_tenant_bookings (default list view).
        - Detail actions     → bookings where the user is either tenant or owner.
        """
        user = self.request.user
        role = getattr(user, "role", None)

        # Base queryset with all related data pre-fetched to avoid N+1 queries
        queryset = Booking.objects.select_related(
            "property",
            "tenant",
            "owner",
        ).prefetch_related("property__images")

        # Admins and superusers have unrestricted access
        if user.is_superuser or role == "admin":
            return queryset.order_by("-id")

        # Owner-specific list: only non-archived bookings on their properties
        if self.action == "my_owner_bookings":
            return queryset.filter(owner=user, archived_by_owner=False).order_by("-id")

        # Tenant-specific list: only non-archived bookings they created
        if self.action == "my_tenant_bookings":
            return queryset.filter(tenant=user, archived_by_tenant=False).order_by("-id")

        # Default list view for tenants
        if self.action == "list":
            return queryset.filter(tenant=user, archived_by_tenant=False).order_by("-id")

        # Detail / mutation actions: user must be either the tenant or the owner
        if self.action in [
            "retrieve",
            "update",
            "partial_update",
            "destroy",
            "clear",
            "clear_for_tenant",
            "reject",
        ]:
            return queryset.filter(Q(tenant=user) | Q(owner=user)).order_by("-id")

        # Any unrecognised action gets an empty queryset as a safe default
        return queryset.none()

    # ------------------------------------------------------------------
    # Serializer context
    # ------------------------------------------------------------------

    def get_serializer_context(self):
        """
        Inject the current request into the serializer context so that
        serializer methods (e.g. building absolute image URLs) can access it.
        """
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    # ------------------------------------------------------------------
    # Create — with idempotency key support
    # ------------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        """
        Create a new booking with idempotency protection.

        Clients must supply an `Idempotency-Key` header (any unique string,
        typically a UUID).  If the same key is sent again with the same
        payload, the original response is returned without creating a
        duplicate booking.  Sending the same key with a *different* payload
        is rejected with 400.

        The idempotency record and the booking are created inside a single
        database transaction so that a crash mid-way leaves no orphaned data.
        """

        # --- Validate that the client provided an idempotency key ----------
        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return Response(
                {"detail": "Idempotency-Key header is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fingerprint the payload so we can detect key reuse with new data
        request_hash = build_request_hash(request.data)

        # --- Check for an existing idempotency record ----------------------
        existing_key = BookingIdempotencyKey.objects.filter(
            user=request.user,
            key=idempotency_key,
            endpoint="/api/bookings/",
        ).first()

        if existing_key:
            # Same key, different payload → client error
            if existing_key.request_hash != request_hash:
                return Response(
                    {"detail": "This Idempotency-Key was already used with a different booking request."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Same key, same payload, and we already have a stored response
            # → return the cached response immediately (idempotent replay)
            if existing_key.response_body is not None and existing_key.response_status is not None:
                return Response(existing_key.response_body, status=existing_key.response_status)

        # --- Validate the incoming booking data ----------------------------
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # --- Atomically create the idempotency record and the booking ------
        with transaction.atomic():
            key_record, created = BookingIdempotencyKey.objects.get_or_create(
                key=idempotency_key,
                defaults={
                    "user": request.user,
                    "endpoint": "/api/bookings/",
                    "request_hash": request_hash,
                },
            )

            if not created:
                # Another request sneaked in concurrently — run the same
                # ownership and payload checks on the record we just fetched
                if key_record.user_id != request.user.id:
                    return Response(
                        {"detail": "This Idempotency-Key belongs to another user."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if key_record.request_hash != request_hash:
                    return Response(
                        {"detail": "This Idempotency-Key was already used with a different booking request."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Concurrent request already completed → return cached response
                if key_record.response_body is not None and key_record.response_status is not None:
                    return Response(key_record.response_body, status=key_record.response_status)

            # Persist the booking (SMS + notifications are triggered inside
            # BookingSerializer.create())
            booking = serializer.save()

            # Serialise the created booking for the response body
            response_serializer = self.get_serializer(booking)
            response_body = response_serializer.data

            # Cache the response so replayed requests get the same answer
            key_record.response_status = status.HTTP_201_CREATED
            key_record.response_body = response_body
            key_record.save(update_fields=["response_status", "response_body"])

        headers = self.get_success_headers(response_body)
        return Response(response_body, status=status.HTTP_201_CREATED, headers=headers)

    # ------------------------------------------------------------------
    # Custom list actions
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def my_owner_bookings(self, request):
        """
        Return all non-archived bookings for properties owned by the
        requesting user.  Restricted to users with the 'owner' or 'admin'
        role (and superusers).
        """
        user = request.user
        role = getattr(user, "role", None)

        # Only owners and admins should be able to call this endpoint
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
        """
        Return all non-archived bookings created by the requesting tenant.
        Any authenticated user can call this; results are always scoped to
        the requester.
        """
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

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """
        Mark a booking as rejected and notify the tenant via both an
        in-app notification and an SMS.

        Only the property owner (or an admin/superuser) may reject a booking.
        Already-rejected and converted bookings cannot be rejected again.
        """
        booking = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        # Permission check: only the owner or an admin can reject
        if user.id != booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can reject this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Guard: already in the target state
        if booking.status == "rejected":
            return Response(
                {"detail": "This booking is already rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard: converted bookings are immutable
        if booking.status == "converted":
            return Response(
                {"detail": "Converted bookings cannot be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist the status change
        booking.status = "rejected"
        booking.save(update_fields=["status"])

        # --- In-app notification ------------------------------------------
        from notifications.utils import send_notification

        send_notification(
            user=booking.tenant,
            message=(
                f"Your booking request for {booking.property.property_name} "
                f"has been rejected."
            ),
            notification_type="booking_rejected",
            property_id=booking.property.id,
        )

        # --- SMS notification ---------------------------------------------
        # Imported here to keep the top-level imports minimal; SMS failure
        # must never crash the HTTP response, so we catch all exceptions.
        from notifications.sms import send_booking_rejected_sms

        try:
            send_booking_rejected_sms(booking)
        except Exception as exc:
            print(f"Rejection SMS failed for booking {booking.id}:", exc)

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Archive (clear) actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="clear")
    def clear(self, request, pk=None):
        """
        Hide a converted booking from the owner's active list by setting
        the `archived_by_owner` flag.  The booking record is not deleted.

        Only the property owner (or an admin/superuser) may clear a booking,
        and only once it has been converted (i.e. a lease has been created).
        """
        booking = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        # Permission check: only the owner or an admin can archive
        if user.id != booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can clear this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only converted bookings can be archived
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
        """
        Hide a converted booking from the tenant's active list by setting
        the `archived_by_tenant` flag.  The booking record is not deleted.

        Only the tenant who made the booking may clear it, and only once
        the booking has been converted.
        """
        booking = self.get_object()

        # Only the tenant who owns this booking may archive it
        if request.user.id != booking.tenant_id:
            return Response(
                {"detail": "Only the tenant can clear this booking from their list."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only converted bookings can be archived
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


# ---------------------------------------------------------------------------
# Inspection Meeting ViewSet
# ---------------------------------------------------------------------------

class InspectionMeetingViewSet(viewsets.ModelViewSet):
    """
    CRUD viewset for InspectionMeeting, plus custom actions for
    cancelling and completing a meeting.

    Owners can create, update, cancel, and complete meetings.
    Tenants can view meetings linked to their bookings.
    Admins/superusers can see and manage all meetings.
    """

    serializer_class = InspectionMeetingSerializer
    permission_classes = [permissions.IsAuthenticated]

    # ------------------------------------------------------------------
    # Queryset filtering
    # ------------------------------------------------------------------

    def get_queryset(self):
        """
        Scope the queryset based on the requester's role:

        - Admins / superusers → all meetings.
        - Owners              → meetings for bookings on their properties.
        - Everyone else       → meetings for bookings where they are the tenant.
        """
        user = self.request.user
        role = getattr(user, "role", None)

        # Base queryset with deep select_related to avoid N+1 queries
        queryset = InspectionMeeting.objects.select_related(
            "booking__property",
            "booking__tenant",
            "booking__owner",
        ).prefetch_related("booking__property__images")

        if user.is_superuser or role == "admin":
            return queryset.order_by("-id")

        if role == "owner":
            return queryset.filter(booking__owner=user).order_by("-id")

        # Default: tenant can only see meetings tied to their own bookings
        return queryset.filter(booking__tenant=user).order_by("-id")

    # ------------------------------------------------------------------
    # Serializer context
    # ------------------------------------------------------------------

    def get_serializer_context(self):
        """Pass the request into the serializer context for URL building."""
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        """Delegate creation to the serializer (notification is sent there)."""
        serializer.save()

    # ------------------------------------------------------------------
    # Status-change actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """
        Cancel a scheduled inspection meeting and notify the tenant.

        Only the property owner (or an admin/superuser) may cancel a meeting.
        Meetings that are already cancelled cannot be cancelled again.
        """
        meeting = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        # Permission check: only the owner or an admin can cancel
        if user.id != meeting.booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can cancel this meeting."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Guard: already in the target state
        if meeting.status == "cancelled":
            return Response(
                {"detail": "This meeting is already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist the status change
        meeting.status = "cancelled"
        meeting.save()

        # Notify the tenant about the cancellation
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
        """
        Mark an upcoming inspection meeting as completed.

        Only the property owner (or an admin/superuser) may mark a meeting
        as completed, and only meetings currently in the 'upcoming' state
        can be transitioned.
        """
        meeting = self.get_object()
        user = request.user
        role = getattr(user, "role", None)

        # Permission check: only the owner or an admin can complete a meeting
        if user.id != meeting.booking.owner_id and not (user.is_superuser or role == "admin"):
            return Response(
                {"detail": "Only the property owner can mark this meeting as completed."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only 'upcoming' meetings can be marked as completed
        if meeting.status != "upcoming":
            return Response(
                {"detail": "Only upcoming meetings can be marked as completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist the status change
        meeting.status = "completed"
        meeting.save()

        serializer = self.get_serializer(meeting)
        return Response(serializer.data, status=status.HTTP_200_OK)