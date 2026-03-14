# users/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from .models import User, PasswordResetCode
from .serializers import (
    RegisterSerializer,
    ForgotPasswordSerializer,
    ConfirmResetCodeSerializer,
    ResetPasswordSerializer
)
import random

class UserViewSet(viewsets.ViewSet):
    """
    User operations: register, login, password reset
    """

    # -------------------
    # Register
    # -------------------
    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "User created successfully",
                "user": {
                    "username": user.username,
                    "email": user.email,
                    "role": user.role
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # -------------------
    # Login
    # -------------------
    @action(detail=False, methods=['post'])
    def login(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        if not email or not password:
            return Response({"error": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, email=email, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                "token": str(refresh.access_token),
                "role": user.role,
                "username": user.username,
                "email": user.email
            }, status=status.HTTP_200_OK)
        return Response({"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED)

    # -------------------
    # Forgot Password
    # -------------------
    @action(detail=False, methods=['post'])
    def forgot_password(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({"detail": "Email not found."}, status=status.HTTP_404_NOT_FOUND)

            code = str(random.randint(100000, 999999))
            PasswordResetCode.objects.create(user=user, code=code)

            send_mail(
                subject="Your Password Reset Code",
                message=f"Use this code to reset your password: {code}",
                from_email="no-reply@asaasehub.com",
                recipient_list=[email],
            )

            return Response({"detail": "Confirmation code sent to email."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # -------------------
    # Confirm Reset Code
    # -------------------
    @action(detail=False, methods=['post'])
    def confirm_code(self, request):
        serializer = ConfirmResetCodeSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['code']
            try:
                reset_entry = PasswordResetCode.objects.get(user__email=email, code=code, is_used=False)
            except PasswordResetCode.DoesNotExist:
                return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

            if reset_entry.is_expired():
                return Response({"detail": "Code expired."}, status=status.HTTP_400_BAD_REQUEST)

            return Response({"detail": "Code confirmed."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # -------------------
    # Reset Password
    # -------------------
    @action(detail=False, methods=['post'])
    def reset_password(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['code']
            new_password = serializer.validated_data['new_password']

            try:
                reset_entry = PasswordResetCode.objects.get(user__email=email, code=code, is_used=False)
            except PasswordResetCode.DoesNotExist:
                return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

            if reset_entry.is_expired():
                return Response({"detail": "Code expired."}, status=status.HTTP_400_BAD_REQUEST)

            user = reset_entry.user
            user.set_password(new_password)
            user.save()

            reset_entry.is_used = True
            reset_entry.save()

            return Response({"detail": "Password reset successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)