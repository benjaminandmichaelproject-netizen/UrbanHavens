from rest_framework import serializers
from .models import Booking, InspectionMeeting
from notifications.utils import send_notification
from django.contrib.auth import get_user_model
from leases.models import TenantLease
User = get_user_model()


def _notify_admins(message, notification_type, property_id=None):
    admins = User.objects.filter(role="admin", is_active=True)
    for admin in admins:
        send_notification(
            user=admin,
            message=message,
            notification_type=notification_type,
            property_id=property_id,
        )


class BookingSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="property.property_name", read_only=True)
    property_city = serializers.CharField(source="property.city", read_only=True)
    property_region = serializers.CharField(source="property.region", read_only=True)
    property_price = serializers.DecimalField(
        source="property.price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    property_type = serializers.CharField(source="property.property_type", read_only=True)
    property_images = serializers.SerializerMethodField()

    tenant_name = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)
    tenant_phone = serializers.CharField(source="tenant.phone", read_only=True)

    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    owner_phone = serializers.CharField(source="owner.phone", read_only=True)

    meeting = serializers.SerializerMethodField()
    lease = serializers.SerializerMethodField()

    class Meta:
        model = Booking
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

    def get_property_images(self, obj):
        request = self.context.get("request")
        result = []

        for img in obj.property.images.all():
            if img.image:
                url = request.build_absolute_uri(img.image.url) if request else img.image.url
                result.append(url)

        return result

    def get_tenant_name(self, obj):
        full = f"{obj.tenant.first_name} {obj.tenant.last_name}".strip()
        return full or obj.tenant.username

    def get_owner_name(self, obj):
        full = f"{obj.owner.first_name} {obj.owner.last_name}".strip()
        return full or obj.owner.username

    def get_meeting(self, obj):
        meeting = getattr(obj, "meeting", None)
        if meeting is None:
            return None
        return InspectionMeetingSerializer(meeting, context=self.context).data

    def get_lease(self, obj):
        lease = getattr(obj, "tenant_lease", None)
        if lease is None:
            return None

        return {
            "id": lease.id,
            "status": lease.status,
            "lease_end_date": str(lease.lease_end_date) if lease.lease_end_date else None,
        }
        
        

    def validate_property(self, property_obj):
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
        from django.utils import timezone
        if value < timezone.localdate():
            raise serializers.ValidationError("Preferred viewing date cannot be in the past.")
        return value
    
    
    
    def validate(self, attrs):
      attrs = super().validate(attrs)

      request = self.context.get("request")
      user = request.user if request else None
      property_obj = attrs.get("property")

      if not user or not user.is_authenticated:
        raise serializers.ValidationError("Authentication required.")
      if property_obj:
        existing_open_booking = Booking.objects.filter(
        tenant=user,
        property=property_obj,
        status__in=["pending", "approved"],
        ).exists()
 
      if existing_open_booking:
        raise serializers.ValidationError({
            "detail": "You already have an active booking request for this property."
        })

      has_active_lease_for_same_property = TenantLease.objects.filter(
        tenant=user,
        property=property_obj,
        status="active",
        ).exists()

      if has_active_lease_for_same_property:
        raise serializers.ValidationError({
            "detail": "You already have an active lease for this property and cannot book it again until the lease ends."
        })
      return attrs
    
    
    
    
    

    def create(self, validated_data):
        request = self.context.get("request")
        property_obj = validated_data["property"]

        booking = Booking.objects.create(
            tenant=request.user,
            owner=property_obj.owner,
            **validated_data
        )
        try:
            send_booking_created_sms(booking)
        except Exception as exc:
             print("SMS sending failed:", exc)
        
        
        

        tenant_full_name = (
            f"{request.user.first_name} {request.user.last_name}".strip()
            or request.user.username
        )

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


class InspectionMeetingSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="booking.property.property_name", read_only=True)
    property_city = serializers.CharField(source="booking.property.city", read_only=True)
    property_region = serializers.CharField(source="booking.property.region", read_only=True)
    property_type = serializers.CharField(source="booking.property.property_type", read_only=True)
    property_images = serializers.SerializerMethodField()

    tenant_name = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(source="booking.tenant.email", read_only=True)
    tenant_phone = serializers.CharField(source="booking.phone", read_only=True)

    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="booking.owner.email", read_only=True)
    owner_phone = serializers.CharField(source="booking.owner.phone", read_only=True)

    preferred_date = serializers.DateField(source="booking.preferred_date", read_only=True)
    preferred_time = serializers.TimeField(source="booking.preferred_time", read_only=True)

    scheduled_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = InspectionMeeting
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

    def get_property_images(self, obj):
        request = self.context.get("request")
        result = []

        for img in obj.booking.property.images.all():
            if img.image:
                url = request.build_absolute_uri(img.image.url) if request else img.image.url
                result.append(url)

        return result

    def get_tenant_name(self, obj):
        tenant = obj.booking.tenant
        full = f"{tenant.first_name} {tenant.last_name}".strip()
        return full or tenant.username

    def get_owner_name(self, obj):
        owner = obj.booking.owner
        full = f"{owner.first_name} {owner.last_name}".strip()
        return full or owner.username

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None
        booking = attrs.get("booking") or (self.instance.booking if self.instance else None)

        if not booking:
            raise serializers.ValidationError("Booking is required.")

        if user and user.id != booking.owner_id:
            if not (user.is_superuser or getattr(user, "role", None) == "admin"):
                raise serializers.ValidationError(
                    "Only the property owner can schedule a meeting for this booking."
                )

        if booking.status in ("converted", "rejected"):
            raise serializers.ValidationError(
                "Cannot schedule a meeting for a converted or rejected booking."
            )

        return attrs

    def create(self, validated_data):
        meeting = InspectionMeeting.objects.create(**validated_data)
        booking = meeting.booking

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

        return meeting

    def update(self, instance, validated_data):
        validated_data.pop("booking", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        send_notification(
            user=instance.booking.tenant,
            message=(
                f"Your inspection meeting for {instance.booking.property.property_name} "
                f"has been updated. New date: {instance.date} at {instance.time}."
            ),
            notification_type="meeting_updated",
            property_id=instance.booking.property.id,
        )

        return instance