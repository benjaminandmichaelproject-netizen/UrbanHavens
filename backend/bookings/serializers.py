from django.contrib.auth import get_user_model
from rest_framework import serializers

from leases.models import TenantLease
from notifications.sms import (
    send_booking_approved_sms,
    send_booking_cancelled_sms,
    send_booking_created_sms,
    send_booking_rejected_sms,
    send_meeting_scheduled_sms,
    send_meeting_updated_sms,
)
from notifications.utils import send_notification

from .models import Booking, InspectionMeeting

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _notify_admins(message: str, notification_type: str, property_id=None) -> None:
    """
    Send an in-app notification to every active admin user.

    Used to keep admins informed of key booking lifecycle events (new
    booking, status changes, etc.) without coupling that logic to any
    single serializer method.
    """
    admins = User.objects.filter(role="admin", is_active=True)
    for admin in admins:
        send_notification(
            user=admin,
            message=message,
            notification_type=notification_type,
            property_id=property_id,
        )


# ---------------------------------------------------------------------------
# Booking Serializer
# ---------------------------------------------------------------------------

class BookingSerializer(serializers.ModelSerializer):
    """
    Serializer for the Booking model.

    Read-only fields are derived from related objects (property, tenant,
    owner) and are included purely for display purposes — they cannot be
    set by the client.  The writable fields are: property, phone,
    preferred_date, preferred_time, and message.

    Validation enforces:
    - The property must be available and approved.
    - The preferred date cannot be in the past.
    - The tenant cannot have another open booking for the same property.
    - The tenant cannot have an active lease for the same property.

    On create, the booking is saved and the landlord receives both an
    in-app notification and an SMS. Admins also receive an in-app
    notification.
    """

    # --- Property display fields (read-only) ------------------------------
    property_name   = serializers.CharField(source="property.property_name", read_only=True)
    property_city   = serializers.CharField(source="property.city",          read_only=True)
    property_region = serializers.CharField(source="property.region",        read_only=True)
    property_price  = serializers.DecimalField(
        source="property.price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    property_type   = serializers.CharField(source="property.property_type", read_only=True)
    property_images = serializers.SerializerMethodField()

    # --- Tenant display fields (read-only) --------------------------------
    tenant_name  = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)
    tenant_phone = serializers.CharField(source="tenant.phone",  read_only=True)

    # --- Owner display fields (read-only) ---------------------------------
    owner_name  = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    owner_phone = serializers.CharField(source="owner.phone",  read_only=True)

    # --- Nested representations -------------------------------------------
    meeting = serializers.SerializerMethodField()
    lease   = serializers.SerializerMethodField()

    class Meta:
        model  = Booking
        fields = [
            "id",
            "property",
            "property_name",
            "property_city",
            "property_region",
            "property_price",
            "property_type",
            "property_images",
            "tenant",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "owner",
            "owner_name",
            "owner_email",
            "owner_phone",
            "phone",
            "preferred_date",
            "preferred_time",
            "message",
            "status",
            "archived_by_owner",
            "archived_by_tenant",
            "meeting",
            "lease",
            "created_at",
        ]
        read_only_fields = [
            "tenant",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "owner",
            "owner_name",
            "owner_email",
            "owner_phone",
            "property_name",
            "property_city",
            "property_region",
            "property_price",
            "property_type",
            "property_images",
            "status",
            "archived_by_owner",
            "archived_by_tenant",
            "meeting",
            "lease",
            "created_at",
        ]

    # ------------------------------------------------------------------
    # SerializerMethodField implementations
    # ------------------------------------------------------------------

    def get_property_images(self, obj):
        """
        Return a list of absolute image URLs for the booked property.

        The request object is pulled from the serializer context so we can
        call build_absolute_uri().  If no request is available (e.g. in
        tests), the raw relative URL is used as a fallback.
        """
        request = self.context.get("request")
        result  = []

        for img in obj.property.images.all():
            if img.image:
                url = request.build_absolute_uri(img.image.url) if request else img.image.url
                result.append(url)

        return result

    def get_tenant_name(self, obj):
        """
        Return the tenant's full name, falling back to their username if
        first_name and last_name are both empty.
        """
        full = f"{obj.tenant.first_name} {obj.tenant.last_name}".strip()
        return full or obj.tenant.username

    def get_owner_name(self, obj):
        """
        Return the owner's full name, falling back to their username if
        first_name and last_name are both empty.
        """
        full = f"{obj.owner.first_name} {obj.owner.last_name}".strip()
        return full or obj.owner.username

    def get_meeting(self, obj):
        """
        Return the serialised InspectionMeeting linked to this booking,
        or None if no meeting has been scheduled yet.

        Uses getattr to avoid an AttributeError when the reverse relation
        does not exist.
        """
        meeting = getattr(obj, "meeting", None)
        if meeting is None:
            return None
        return InspectionMeetingSerializer(meeting, context=self.context).data

    def get_lease(self, obj):
        """
        Return a minimal summary of the TenantLease linked to this booking
        (id, status, lease_end_date), or None if no lease exists yet.

        A full lease serializer is intentionally avoided here to keep the
        booking response payload compact.
        """
        lease = getattr(obj, "tenant_lease", None)
        if lease is None:
            return None

        return {
            "id":              lease.id,
            "status":          lease.status,
            "lease_end_date":  str(lease.lease_end_date) if lease.lease_end_date else None,
        }

    # ------------------------------------------------------------------
    # Field-level validation
    # ------------------------------------------------------------------

    def validate_property(self, property_obj):
        """
        Ensure the selected property is bookable:
        - Must be marked as available.
        - Must have been approved by an admin.
        - Must be linked to a registered landlord account.
        """
        if not property_obj.is_available:
            raise serializers.ValidationError("This property is not available for booking.")

        if getattr(property_obj, "approval_status", None) != "approved":
            raise serializers.ValidationError("Only approved properties can be booked.")

        if property_obj.owner is None:
            raise serializers.ValidationError(
                "This property cannot be booked because it is not linked to a registered landlord account."
            )

        return property_obj

    def validate_preferred_date(self, value):
        """Reject preferred viewing dates that fall in the past."""
        from django.utils import timezone

        if value < timezone.localdate():
            raise serializers.ValidationError("Preferred viewing date cannot be in the past.")
        return value

    # ------------------------------------------------------------------
    # Object-level validation
    # ------------------------------------------------------------------

    def validate(self, attrs):
        """
        Cross-field validation run after all individual field validators pass.

        Checks:
        1. The user is authenticated (belt-and-suspenders; the view already
           requires authentication).
        2. The tenant does not already have a pending or approved booking
           for the same property.
        3. The tenant does not already have an active lease for the same
           property (re-booking would be pointless).
        """
        attrs = super().validate(attrs)

        request      = self.context.get("request")
        user         = request.user if request else None
        property_obj = attrs.get("property")

        # Authentication guard
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if property_obj:
            # Prevent duplicate open booking requests for the same property
            existing_open_booking = Booking.objects.filter(
                tenant=user,
                property=property_obj,
                status__in=["pending", "approved"],
            ).exists()

            if existing_open_booking:
                raise serializers.ValidationError({
                    "detail": "You already have an active booking request for this property."
                })

        # Prevent booking a property the tenant is already leasing
        has_active_lease = TenantLease.objects.filter(
            tenant=user,
            property=property_obj,
            status="active",
        ).exists()

        if has_active_lease:
            raise serializers.ValidationError({
                "detail": (
                    "You already have an active lease for this property "
                    "and cannot book it again until the lease ends."
                )
            })

        return attrs

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(self, validated_data):
        """
        Persist a new Booking and fire post-creation notifications.

        Steps:
        1. Create the Booking, automatically assigning the requesting user
           as tenant and the property's owner as owner.
        2. Send an SMS to the landlord (failure is swallowed so a missing
           phone number never breaks the booking flow).
        3. Send an in-app notification to the landlord.
        4. Send in-app notifications to all admin users.
        """
        request      = self.context.get("request")
        property_obj = validated_data["property"]

        # Create the booking and link tenant/owner from context
        booking = Booking.objects.create(
            tenant=request.user,
            owner=property_obj.owner,
            **validated_data,
        )

        # --- SMS to landlord ----------------------------------------------
        # Wrapped in try/except so that a missing or invalid landlord phone
        # number never prevents the booking from being created.
        try:
            send_booking_created_sms(booking)
        except Exception as exc:
            print(f"Booking created SMS failed for booking {booking.id}:", exc)

        # Build the tenant's display name for notification messages
        tenant_full_name = (
            f"{request.user.first_name} {request.user.last_name}".strip()
            or request.user.username
        )

        # --- In-app notification to landlord ------------------------------
        send_notification(
            user=property_obj.owner,
            message=(
                f"{tenant_full_name} requested a viewing for "
                f"{property_obj.property_name} on {booking.preferred_date} "
                f"at {booking.preferred_time}."
            ),
            notification_type="inspection_request",
            property_id=property_obj.id,
        )

        # --- In-app notifications to all admins ---------------------------
        _notify_admins(
            message=(
                f"New booking: {tenant_full_name} requested a viewing for "
                f"{property_obj.property_name} on {booking.preferred_date} "
                f"at {booking.preferred_time}."
            ),
            notification_type="new_booking",
            property_id=property_obj.id,
        )

        return booking


# ---------------------------------------------------------------------------
# Inspection Meeting Serializer
# ---------------------------------------------------------------------------

class InspectionMeetingSerializer(serializers.ModelSerializer):
    """
    Serializer for the InspectionMeeting model.

    All property, tenant, and owner fields are read-only display fields
    derived from the related Booking.  The writable fields are: booking,
    date, time, location, and note.

    Validation ensures:
    - Only the property owner (or admin) can schedule a meeting.
    - A meeting cannot be scheduled for a converted or rejected booking.

    On create, the tenant receives an in-app notification that a meeting
    has been scheduled.  On update, the tenant is notified of the changes.
    """

    # --- Property display fields (sourced through booking FK) -------------
    property_name   = serializers.CharField(source="booking.property.property_name", read_only=True)
    property_city   = serializers.CharField(source="booking.property.city",          read_only=True)
    property_region = serializers.CharField(source="booking.property.region",        read_only=True)
    property_type   = serializers.CharField(source="booking.property.property_type", read_only=True)
    property_images = serializers.SerializerMethodField()

    # --- Tenant display fields --------------------------------------------
    tenant_name  = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(source="booking.tenant.email", read_only=True)
    # Note: tenant_phone is sourced from booking.phone (the contact number
    # provided at booking time), not booking.tenant.phone, to respect any
    # number the tenant explicitly supplied during the booking flow.
    tenant_phone = serializers.CharField(source="booking.phone", read_only=True)

    # --- Owner display fields ---------------------------------------------
    owner_name  = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="booking.owner.email", read_only=True)
    owner_phone = serializers.CharField(source="booking.owner.phone",  read_only=True)

    # --- Booking date/time mirrors (read-only convenience fields) ---------
    preferred_date = serializers.DateField(source="booking.preferred_date", read_only=True)
    preferred_time = serializers.TimeField(source="booking.preferred_time", read_only=True)

    # Alias created_at → scheduled_at for a more descriptive API surface
    scheduled_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model  = InspectionMeeting
        fields = [
            "id",
            "booking",
            "property_name",
            "property_city",
            "property_region",
            "property_type",
            "property_images",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "owner_name",
            "owner_email",
            "owner_phone",
            "preferred_date",
            "preferred_time",
            "date",
            "time",
            "location",
            "note",
            "status",
            "scheduled_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "scheduled_at",
            "updated_at",
            "property_name",
            "property_city",
            "property_region",
            "property_type",
            "property_images",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "owner_name",
            "owner_email",
            "owner_phone",
            "preferred_date",
            "preferred_time",
        ]

    # ------------------------------------------------------------------
    # SerializerMethodField implementations
    # ------------------------------------------------------------------

    def get_property_images(self, obj):
        """Return absolute image URLs for the property linked to the meeting's booking."""
        request = self.context.get("request")
        result  = []

        for img in obj.booking.property.images.all():
            if img.image:
                url = request.build_absolute_uri(img.image.url) if request else img.image.url
                result.append(url)

        return result

    def get_tenant_name(self, obj):
        """Return the tenant's full name, falling back to username."""
        tenant = obj.booking.tenant
        full   = f"{tenant.first_name} {tenant.last_name}".strip()
        return full or tenant.username

    def get_owner_name(self, obj):
        """Return the owner's full name, falling back to username."""
        owner = obj.booking.owner
        full  = f"{owner.first_name} {owner.last_name}".strip()
        return full or owner.username

    # ------------------------------------------------------------------
    # Object-level validation
    # ------------------------------------------------------------------

    def validate(self, attrs):
        """
        Ensure the requesting user is authorised to manage this meeting
        and that the linked booking is in a schedulable state.

        Rules:
        - Only the property owner (or an admin/superuser) may create or
          update a meeting.
        - Meetings cannot be scheduled for bookings that are already
          converted or rejected.
        """
        request = self.context.get("request")
        user    = request.user if request else None

        # On create, booking comes from attrs; on update, fall back to the
        # existing instance's booking
        booking = attrs.get("booking") or (self.instance.booking if self.instance else None)

        if not booking:
            raise serializers.ValidationError("Booking is required.")

        # Permission check: must be the property owner or an admin
        if user and user.id != booking.owner_id:
            if not (user.is_superuser or getattr(user, "role", None) == "admin"):
                raise serializers.ValidationError(
                    "Only the property owner can schedule a meeting for this booking."
                )

        # Booking must be in an open state; converted/rejected are terminal
        if booking.status in ("converted", "rejected"):
            raise serializers.ValidationError(
                "Cannot schedule a meeting for a converted or rejected booking."
            )

        return attrs

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(self, validated_data):
        """
        Persist a new InspectionMeeting and notify the tenant.

        After saving, an in-app notification is sent to the tenant with
        the meeting date, time, and location.
        """
        meeting = InspectionMeeting.objects.create(**validated_data)
        booking = meeting.booking

        # Notify the tenant that a meeting has been scheduled
        send_notification(
            user=booking.tenant,
            message=(
                f"An inspection meeting has been scheduled for "
                f"{booking.property.property_name} on {meeting.date} at {meeting.time}. "
                f"Location: {meeting.location}."
            ),
            notification_type="meeting_scheduled",
            property_id=booking.property.id,
        )

        # --- SMS to tenant ------------------------------------------------
        # Sends date, time, and location so the tenant has all details
        # in one message. Failure is swallowed so it never breaks the flow.
        try:
            send_meeting_scheduled_sms(meeting)
        except Exception as exc:
            print(f"Meeting scheduled SMS failed for meeting {meeting.id}:", exc)

        return meeting

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    def update(self, instance, validated_data):
        """
        Update an existing InspectionMeeting and notify the tenant of changes.

        The booking FK is intentionally excluded from updates — a meeting
        cannot be reassigned to a different booking after creation.
        """
        # Prevent accidental reassignment of the booking relation
        validated_data.pop("booking", None)

        # Apply all other field updates to the instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # Notify the tenant that the meeting details have changed
        send_notification(
            user=instance.booking.tenant,
            message=(
                f"Your inspection meeting for {instance.booking.property.property_name} "
                f"has been updated. New date: {instance.date} at {instance.time}."
            ),
            notification_type="meeting_updated",
            property_id=instance.booking.property.id,
        )

        # --- SMS to tenant ------------------------------------------------
        # Sends updated date, time, and location so the tenant has the
        # latest details. Failure is swallowed so it never breaks the flow.
        try:
            send_meeting_updated_sms(instance)
        except Exception as exc:
            print(f"Meeting updated SMS failed for meeting {instance.id}:", exc)

        return instance