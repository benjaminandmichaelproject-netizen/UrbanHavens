from rest_framework.permissions import IsAuthenticated

import random
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, PasswordResetCode
from .serializers import (
    RegisterSerializer,
    ForgotPasswordSerializer,
    ConfirmResetCodeSerializer,
    ResetPasswordSerializer,
)


class UserViewSet(viewsets.ViewSet):
    """
    User operations: register, login, password reset
    """

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            landlord_profile = None
            if user.role == "owner":
                profile = getattr(user, "landlord_profile", None)
                if profile:
                    landlord_profile = {
                        "business_name": profile.business_name,
                        "document_type": profile.document_type,
                        "id_number": profile.id_number,
                        "document_file": profile.document_file.url if profile.document_file else None,
                        "is_verified": profile.is_verified,
                        "submitted_at": profile.submitted_at,
                    }

            return Response(
                {
                    "message": "Account created successfully.",
                    "user": {
                        "username": user.username,
                        "email": user.email,
                        "phone": user.phone,
                        "role": user.role,
                        "landlord_profile": landlord_profile,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], parser_classes=[JSONParser, FormParser])
    def login(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=email, password=password)

        if not user:
            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)

        landlord_profile = None
        if user.role == "owner":
            profile = getattr(user, "landlord_profile", None)
            if profile:
                landlord_profile = {
                    "business_name": profile.business_name,
                    "document_type": profile.document_type,
                    "id_number": profile.id_number,
                    "document_file": profile.document_file.url if profile.document_file else None,
                    "is_verified": profile.is_verified,
                    "submitted_at": profile.submitted_at,
                }

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "id": user.id,
                "role": user.role,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "phone": user.phone,
                "is_superuser": user.is_superuser,
                "landlord_profile": landlord_profile,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def owners(self, request):
        user = request.user

        if not (user.is_superuser or getattr(user, "role", None) == "admin"):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )

        owners = User.objects.filter(role="owner").order_by("username")

        data = []
        for owner in owners:
            profile = getattr(owner, "landlord_profile", None)

            data.append({
                "id": owner.id,
                "username": owner.username,
                "first_name": owner.first_name,
                "last_name": owner.last_name,
                "email": owner.email,
                "phone": owner.phone,
                "role": owner.role,
                "landlord_profile": {
                    "business_name": profile.business_name if profile else None,
                    "document_type": profile.document_type if profile else None,
                    "id_number": profile.id_number if profile else None,
                    "document_file": profile.document_file.url if profile and profile.document_file else None,
                    "is_verified": profile.is_verified if profile else False,
                } if profile else None,
            })

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated], url_path="all-users")
    def all_users(self, request):
        user = request.user

        if not (user.is_superuser or getattr(user, "role", None) == "admin"):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )

        users = User.objects.all().order_by("username")

        data = []
        for item in users:
            profile = getattr(item, "landlord_profile", None)

            data.append({
                "id": item.id,
                "name": f"{item.first_name} {item.last_name}".strip() or item.username,
                "username": item.username,
                "email": item.email,
                "phone": item.phone,
                "role": item.role,
                "status": "active" if item.is_active else "inactive",
                "verified": profile.is_verified if profile else False,
                "is_superuser": item.is_superuser,
                "is_staff": item.is_staff,
            })

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="forgot-password")
    def forgot_password(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "If that email is registered, a reset code has been sent."},
                status=status.HTTP_200_OK,
            )

        PasswordResetCode.objects.filter(user=user, is_used=False).delete()

        code = str(random.randint(100000, 999999))
        PasswordResetCode.objects.create(user=user, code=code)

        send_mail(
            subject="Your Password Reset Code",
            message=f"Your reset code is: {code}\n\nThis code expires in 15 minutes.",
            from_email="no-reply@asaasehub.com",
            recipient_list=[email],
        )

        return Response(
            {"detail": "If that email is registered, a reset code has been sent."},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="confirm-code")
    def confirm_code(self, request):
        serializer = ConfirmResetCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()
        code = serializer.validated_data["code"]

        try:
            entry = PasswordResetCode.objects.get(user__email=email, code=code, is_used=False)
        except PasswordResetCode.DoesNotExist:
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        if entry.is_expired():
            return Response({"detail": "Code has expired."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Code confirmed."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower()
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]

        try:
            entry = PasswordResetCode.objects.get(user__email=email, code=code, is_used=False)
        except PasswordResetCode.DoesNotExist:
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        if entry.is_expired():
            return Response({"detail": "Code has expired."}, status=status.HTTP_400_BAD_REQUEST)

        user = entry.user
        user.set_password(new_password)
        user.save()

        entry.is_used = True
        entry.save()

        return Response({"detail": "Password reset successfully."}, status=status.HTTP_200_OK)
      
      
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="toggle-verification")
    def toggle_verification(self, request, pk=None):
        user = request.user

        if not (user.is_superuser or getattr(user, "role", None) == "admin"):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            target_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if target_user.role != "owner":
            return Response(
                {"detail": "Only owners can be verified."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = getattr(target_user, "landlord_profile", None)
        if not profile:
            return Response(
                {"detail": "This owner does not have a landlord profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.is_verified = not profile.is_verified
        profile.save()

        return Response(
            {
                "message": "Verification status updated successfully.",
                "user_id": target_user.id,
                "verified": profile.is_verified,
            },
            status=status.HTTP_200_OK,
        )