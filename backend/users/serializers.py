# users/serializers.py
from rest_framework import serializers
from .models import User, PasswordResetCode, LandlordProfile

# -------------------
# Registration Serializer
# -------------------
# users/serializers.py
class RegisterSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False, allow_blank=True)  # Add this
    document_type = serializers.CharField(required=False, allow_blank=True)
    document_file = serializers.FileField(required=False)
    business_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role', 'phone', 'document_type', 'document_file', 'business_name')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        role = validated_data.get('role')
        document_type = validated_data.pop('document_type', None)
        document_file = validated_data.pop('document_file', None)
        business_name = validated_data.pop('business_name', None)

        user = User.objects.create_user(**validated_data)  # includes phone

        if role == 'owner':  # your model uses 'owner', frontend must send 'owner' not 'landlord'
            LandlordProfile.objects.create(
                user=user,
                document_type=document_type,
                document_file=document_file,
                business_name=business_name
            )
        return user

# -------------------
# Forgot Password Serializers
# -------------------
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

class ConfirmResetCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)