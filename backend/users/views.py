import random

from django.contrib.auth import authenticate
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .email_service import BrevoEmailError, send_brevo_email
from .models import PasswordResetCode, User
from .serializers import (
    ConfirmResetCodeSerializer,
    ForgotPasswordSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
)


class UserViewSet(viewsets.ViewSet):
    """
    Handles user registration, login, administration,
    password reset, and owner verification.
    """

    @action(
        detail=False,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
    )
    def register(self, request):
        """
        Creates a new UrbanHavens user account.
        """

        # Check whether the submitted registration information is valid.
        serializer = RegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save the new user after validation succeeds.
        user = serializer.save()

        # Prepare the landlord profile only when the new user is an owner.
        landlord_profile = None

        if user.role == "owner":
            profile = getattr(user, "landlord_profile", None)

            if profile:
                landlord_profile = {
                    "business_name": profile.business_name,
                    "document_type": profile.document_type,
                    "id_number": profile.id_number,
                    "document_file": (
                        profile.document_file.url
                        if profile.document_file
                        else None
                    ),
                    "is_verified": profile.is_verified,
                    "submitted_at": profile.submitted_at,
                }

        # Return the newly created account information.
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

    @action(
        detail=False,
        methods=["post"],
        parser_classes=[JSONParser, FormParser],
    )
    def login(self, request):
        """
        Authenticates the user and returns JWT access and refresh tokens.
        """

        # Read and clean the submitted login details.
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        # Stop the request when either field is missing.
        if not email or not password:
            return Response(
                {
                    "error": "Email and password are required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check the email and password against Django authentication.
        user = authenticate(
            request,
            username=email,
            password=password,
        )

        # Reject the login when the credentials are incorrect.
        if not user:
            return Response(
                {
                    "error": "Invalid email or password.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Create JWT tokens for the authenticated user.
        refresh = RefreshToken.for_user(user)

        # Include landlord information when the logged-in user is an owner.
        landlord_profile = None

        if user.role == "owner":
            profile = getattr(user, "landlord_profile", None)

            if profile:
                landlord_profile = {
                    "business_name": profile.business_name,
                    "document_type": profile.document_type,
                    "id_number": profile.id_number,
                    "document_file": (
                        profile.document_file.url
                        if profile.document_file
                        else None
                    ),
                    "is_verified": profile.is_verified,
                    "submitted_at": profile.submitted_at,
                }

        # Return the JWT tokens and user information to the frontend.
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

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticated],
    )
    def owners(self, request):
        """
        Returns all registered owners to an administrator.
        """

        # Get the currently logged-in user.
        user = request.user

        # Allow only a superuser or an account with the admin role.
        if not (
            user.is_superuser
            or getattr(user, "role", None) == "admin"
        ):
            return Response(
                {
                    "detail": (
                        "You do not have permission to perform this action."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Load every user whose role is owner.
        owners = User.objects.filter(
            role="owner",
        ).order_by("username")

        data = []

        # Build the response information for each owner.
        for owner in owners:
            profile = getattr(owner, "landlord_profile", None)

            data.append(
                {
                    "id": owner.id,
                    "username": owner.username,
                    "first_name": owner.first_name,
                    "last_name": owner.last_name,
                    "email": owner.email,
                    "phone": owner.phone,
                    "role": owner.role,
                    "landlord_profile": (
                        {
                            "business_name": profile.business_name,
                            "document_type": profile.document_type,
                            "id_number": profile.id_number,
                            "document_file": (
                                profile.document_file.url
                                if profile.document_file
                                else None
                            ),
                            "is_verified": profile.is_verified,
                        }
                        if profile
                        else None
                    ),
                }
            )

        # Return the complete owner list.
        return Response(
            data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticated],
        url_path="all-users",
    )
    def all_users(self, request):
        """
        Returns all UrbanHavens users to an administrator.
        """

        # Get the currently logged-in user.
        user = request.user

        # Allow only a superuser or an account with the admin role.
        if not (
            user.is_superuser
            or getattr(user, "role", None) == "admin"
        ):
            return Response(
                {
                    "detail": (
                        "You do not have permission to perform this action."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Load every registered user.
        users = User.objects.all().order_by("username")

        data = []

        # Build a simple response for each user.
        for item in users:
            profile = getattr(item, "landlord_profile", None)

            full_name = (
                f"{item.first_name} {item.last_name}".strip()
                or item.username
            )

            data.append(
                {
                    "id": item.id,
                    "name": full_name,
                    "username": item.username,
                    "email": item.email,
                    "phone": item.phone,
                    "role": item.role,
                    "status": (
                        "active"
                        if item.is_active
                        else "inactive"
                    ),
                    "verified": (
                        profile.is_verified
                        if profile
                        else False
                    ),
                    "is_superuser": item.is_superuser,
                    "is_staff": item.is_staff,
                }
            )

        # Return the complete user list.
        return Response(
            data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="forgot-password",
    )
    def forgot_password(self, request):
        """
        Generates and sends a password reset code through Brevo.
        """

        # Validate the email submitted by the user.
        serializer = ForgotPasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Convert the email to lowercase before searching for the account.
        email = serializer.validated_data["email"].strip().lower()

        # Look for a registered user with the submitted email.
        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            # Return a general message so nobody can check which emails exist.
            return Response(
                {
                    "detail": (
                        "If that email is registered, "
                        "a reset code has been sent."
                    ),
                },
                status=status.HTTP_200_OK,
            )

        # Remove old unused codes before creating a new one.
        PasswordResetCode.objects.filter(
            user=user,
            is_used=False,
        ).delete()

        # Generate a new six-digit reset code.
        code = str(random.randint(100000, 999999))

        # Save the reset code in the database.
        reset_entry = PasswordResetCode.objects.create(
            user=user,
            code=code,
        )

        # Use the person's first name, username, or a general greeting.
        recipient_name = (
            user.first_name.strip()
            if user.first_name
            else user.username
        )

        # Send the code through the Brevo HTTPS email API.
        try:
            send_brevo_email(
                recipient_email=email,
                recipient_name=recipient_name,
                subject="UrbanHavens Password Reset Code",
                text_content=(
                    f"Hello {recipient_name},\n\n"
                    "We received a request to reset your "
                    "UrbanHavens password.\n\n"
                    f"Your password reset code is: {code}\n\n"
                    "This code expires in 15 minutes.\n\n"
                    "If you did not request this password reset, "
                    "you can ignore this email.\n\n"
                    "UrbanHavens Team"
                ),
                html_content=f"""
                <div
                    style="
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 32px;
                        font-family: Arial, sans-serif;
                        color: #1f2937;
                        background-color: #ffffff;
                    "
                >
                    <h2
                        style="
                            margin-bottom: 20px;
                            color: #111827;
                        "
                    >
                        UrbanHavens
                    </h2>

                    <p>
                        Hello {recipient_name},
                    </p>

                    <p>
                        We received a request to reset your
                        UrbanHavens password.
                    </p>

                    <p>
                        Your password reset code is:
                    </p>

                    <div
                        style="
                            margin: 24px 0;
                            padding: 20px;
                            text-align: center;
                            font-size: 30px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            background-color: #f3f4f6;
                            border-radius: 8px;
                        "
                    >
                        {code}
                    </div>

                    <p>
                        This code expires in
                        <strong>15 minutes</strong>.
                    </p>

                    <p>
                        If you did not request this password reset,
                        you can safely ignore this email.
                    </p>

                    <p style="margin-top: 30px;">
                        Regards,<br>
                        UrbanHavens Team
                    </p>
                </div>
                """,
            )

        except BrevoEmailError:
            # Delete the code because the user did not receive it.
            reset_entry.delete()

            return Response(
                {
                    "detail": (
                        "Unable to send the password reset email. "
                        "Please try again shortly."
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Return a general success message after the email is sent.
        return Response(
            {
                "detail": (
                    "If that email is registered, "
                    "a reset code has been sent."
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="confirm-code",
    )
    def confirm_code(self, request):
        """
        Checks whether the submitted reset code is correct and still valid.
        """

        # Validate the submitted email and code.
        serializer = ConfirmResetCodeSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Clean the submitted email and read the reset code.
        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"]

        # Find an unused reset code belonging to the submitted email.
        try:
            entry = PasswordResetCode.objects.get(
                user__email=email,
                code=code,
                is_used=False,
            )

        except PasswordResetCode.DoesNotExist:
            return Response(
                {
                    "detail": "Invalid code.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reject the code if its allowed time has passed.
        if entry.is_expired():
            return Response(
                {
                    "detail": "Code has expired.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Confirm that the code is valid.
        return Response(
            {
                "detail": "Code confirmed.",
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="reset-password",
    )
    def reset_password(self, request):
        """
        Changes the user's password after validating the reset code.
        """

        # Validate the email, code, and new password.
        serializer = ResetPasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Read the validated password-reset information.
        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]

        # Find the unused reset code for the submitted account.
        try:
            entry = PasswordResetCode.objects.get(
                user__email=email,
                code=code,
                is_used=False,
            )

        except PasswordResetCode.DoesNotExist:
            return Response(
                {
                    "detail": "Invalid code.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reject the reset request when the code has expired.
        if entry.is_expired():
            return Response(
                {
                    "detail": "Code has expired.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Securely hash and save the user's new password.
        user = entry.user
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Mark the reset code as used so it cannot be reused.
        entry.is_used = True
        entry.save(update_fields=["is_used"])

        # Confirm that the password was changed successfully.
        return Response(
            {
                "detail": "Password reset successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="toggle-verification",
    )
    def toggle_verification(self, request, pk=None):
        """
        Allows an administrator to verify or unverify an owner.
        """

        # Get the administrator making the request.
        user = request.user

        # Allow only a superuser or an account with the admin role.
        if not (
            user.is_superuser
            or getattr(user, "role", None) == "admin"
        ):
            return Response(
                {
                    "detail": (
                        "You do not have permission to perform this action."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Find the user whose verification status should be changed.
        try:
            target_user = User.objects.get(pk=pk)

        except User.DoesNotExist:
            return Response(
                {
                    "detail": "User not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only landlord or owner accounts can be verified.
        if target_user.role != "owner":
            return Response(
                {
                    "detail": "Only owners can be verified.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the owner's landlord profile.
        profile = getattr(
            target_user,
            "landlord_profile",
            None,
        )

        # Stop when the owner does not have a landlord profile.
        if not profile:
            return Response(
                {
                    "detail": (
                        "This owner does not have a landlord profile."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Change verified owners to unverified and vice versa.
        profile.is_verified = not profile.is_verified
        profile.save(update_fields=["is_verified"])

        # Return the owner's new verification status.
        return Response(
            {
                "message": "Verification status updated successfully.",
                "user_id": target_user.id,
                "verified": profile.is_verified,
            },
            status=status.HTTP_200_OK,
        )