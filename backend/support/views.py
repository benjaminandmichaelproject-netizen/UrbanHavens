from django.shortcuts import render

from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import AdminSupportSession
from .serializers import (
    AdminSupportSessionSerializer,
    CreateAdminSupportSessionSerializer,
)


def expire_session_if_needed(session):
    if (
        session.status == AdminSupportSession.STATUS_ACTIVE
        and session.expires_at
        and timezone.now() >= session.expires_at
    ):
        session.mark_expired()


def push_support_event(user_id, payload: dict):
    """
    Send a support_event WebSocket message to a specific user's channel group.
    'payload' must include at least an 'event' key.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "support.event",   # → calls support_event() in consumer
            **payload,
        },
    )


class ActiveAdminsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        admins = request.user.__class__.objects.filter(role="admin", is_active=True)
        data = [
            {
                "id": admin.id,
                "name": admin.username,
                "email": admin.email,
            }
            for admin in admins
        ]
        return Response(data)


class OwnerCreateSupportSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != "owner":
            return Response(
                {"detail": "Only owners can send admin support invites."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreateAdminSupportSessionSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        session = serializer.save()

        # ── Notify the admin live so they see the invite without refreshing
        push_support_event(
            session.admin.id,
            {
                "event": "support_invite_received",
                "session_id": str(session.id),
                "status": session.status,
                "owner_name": session.owner.username,
                "owner_email": session.owner.email,
                "reason": session.reason,
                "duration_minutes": session.duration_minutes,
            },
        )

        return Response(
            AdminSupportSessionSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )


class OwnerCurrentSupportSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "owner":
            return Response(
                {"detail": "Only owners can view owner support session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        session = (
            AdminSupportSession.objects.filter(owner=request.user)
            .order_by("-invited_at")
            .first()
        )

        if not session:
            return Response(None, status=status.HTTP_200_OK)

        expire_session_if_needed(session)
        return Response(AdminSupportSessionSerializer(session).data)


class AdminPendingSupportSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can view pending invites."},
                status=status.HTTP_403_FORBIDDEN,
            )

        sessions = AdminSupportSession.objects.filter(
            admin=request.user,
            status=AdminSupportSession.STATUS_PENDING,
        )
        return Response(AdminSupportSessionSerializer(sessions, many=True).data)


class AdminRespondSupportSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can respond to invites."},
                status=status.HTTP_403_FORBIDDEN,
            )

        action = request.data.get("action")
        if action not in ["accept", "decline"]:
            return Response(
                {"detail": "Action must be 'accept' or 'decline'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            session = AdminSupportSession.objects.get(pk=pk, admin=request.user)
        except AdminSupportSession.DoesNotExist:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)

        if session.status != AdminSupportSession.STATUS_PENDING:
            return Response(
                {"detail": "This invite is no longer pending."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "accept":
            other_active = AdminSupportSession.objects.filter(
                admin=request.user,
                status=AdminSupportSession.STATUS_ACTIVE,
            ).exists()

            if other_active:
                return Response(
                    {"detail": "You already have an active support session."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            session.activate()

            # ── Notify the owner live: invite was accepted, session is now active
            push_support_event(
                session.owner.id,
                {
                    "event": "support_invite_accepted",
                    "session_id": str(session.id),
                    "status": session.status,
                    "admin_name": session.admin.username,
                    "admin_email": session.admin.email,
                    "expires_at": session.expires_at.isoformat() if session.expires_at else None,
                },
            )

        else:
            session.mark_declined()

            # ── Notify the owner live: invite was declined
            push_support_event(
                session.owner.id,
                {
                    "event": "support_invite_declined",
                    "session_id": str(session.id),
                    "status": session.status,
                },
            )

        return Response(AdminSupportSessionSerializer(session).data)


class OwnerTerminateSupportSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != "owner":
            return Response(
                {"detail": "Only owners can terminate support sessions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            session = AdminSupportSession.objects.get(pk=pk, owner=request.user)
        except AdminSupportSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        expire_session_if_needed(session)

        if session.status != AdminSupportSession.STATUS_ACTIVE:
            return Response(
                {"detail": "Only active sessions can be terminated."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.mark_terminated(ended_by=request.user)

        # ── Notify the admin live: session was terminated by the owner
        push_support_event(
            session.admin.id,
            {
                "event": "support_session_terminated",
                "session_id": str(session.id),
                "status": session.status,
            },
        )

        return Response(AdminSupportSessionSerializer(session).data)


class AdminCurrentSupportSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can view active support session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        session = (
            AdminSupportSession.objects.filter(
                admin=request.user,
                status=AdminSupportSession.STATUS_ACTIVE,
            )
            .order_by("-started_at")
            .first()
        )

        if not session:
            return Response(None, status=status.HTTP_200_OK)

        expire_session_if_needed(session)

        if session.status != AdminSupportSession.STATUS_ACTIVE:
            return Response(None, status=status.HTTP_200_OK)

        return Response(AdminSupportSessionSerializer(session).data)