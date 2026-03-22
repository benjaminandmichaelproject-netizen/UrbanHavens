from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, LandlordProfile


def _notify_admins(message, notification_type, property_id=None):
    """Send a notification to all admin users."""
    # Import here to avoid circular imports
    from notifications.utils import send_notification

    admins = User.objects.filter(role="admin", is_active=True)
    for admin in admins:
        send_notification(
            user=admin,
            message=message,
            notification_type=notification_type,
            property_id=property_id,
        )


class RegisterSerializer(serializers.Serializer):
    # ─── User fields ───
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=["tenant", "owner", "admin"])

    # ─── Landlord fields ───
    business_name = serializers.CharField(required=False, allow_blank=True)
    document_type = serializers.CharField(required=False, allow_blank=True)
    document_file = serializers.FileField(required=False, allow_null=True)
    id_number = serializers.CharField(required=False, allow_blank=True)

    # ─── VALIDATIONS ───
    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        role = attrs.get("role")

        # Only owner needs landlord profile details
        if role == "owner":
            if not attrs.get("business_name", "").strip():
                raise serializers.ValidationError({"business_name": "Business name is required."})
            if not attrs.get("document_type", "").strip():
                raise serializers.ValidationError({"document_type": "ID type is required."})

            id_number = attrs.get("id_number", "").strip()
            if not id_number:
                raise serializers.ValidationError({"id_number": "ID number is required."})

            if LandlordProfile.objects.filter(id_number=id_number).exists():
                raise serializers.ValidationError({"id_number": "This ID number is already registered."})

            if not attrs.get("document_file"):
                raise serializers.ValidationError({"document_file": "ID document is required."})

        return attrs

    # ─── CREATE USER ───
    def create(self, validated_data):
        business_name = validated_data.pop("business_name", None)
        document_type = validated_data.pop("document_type", None)
        document_file = validated_data.pop("document_file", None)
        id_number = validated_data.pop("id_number", None)

        # Generate unique username
        base_username = validated_data["email"].split("@")[0]
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        role = validated_data["role"]

        # Create user
        user = User.objects.create_user(
            username=username,
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            phone=validated_data.get("phone"),
            role=role,
            is_staff=True if role == "admin" else False,
        )

        # Create landlord profile only for owner
        if user.role == "owner":
            LandlordProfile.objects.create(
                user=user,
                business_name=business_name,
                document_type=document_type,
                document_file=document_file,
                id_number=id_number,
            )

        # ── Notify all admins of new registration ──────────────────────
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username
        role_label = role.capitalize()
        _notify_admins(
            message=f"New {role_label} account registered: {full_name} ({user.email}).",
            notification_type="new_user",
        )

        return user


# ─── Password reset serializers ─────────────────────────────────────────────
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmResetCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value