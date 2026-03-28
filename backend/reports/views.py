from django.shortcuts import render

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .models import Report
from .serializers import ReportCreateSerializer, ReportAdminSerializer


class SubmitReportView(generics.CreateAPIView):
    """
    POST /api/reports/
    Any authenticated user (tenant or landlord) can submit a report.
    """
    serializer_class = ReportCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {"message": "Report submitted successfully.", "data": serializer.data},
            status=status.HTTP_201_CREATED,
        )


class MyReportsView(generics.ListAPIView):
    """
    GET /api/reports/my-reports/
    Returns all reports submitted by the logged-in user.
    """
    serializer_class = ReportCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Report.objects
            .filter(reported_by=self.request.user)
            .select_related(
                "reported_property",
                "reported_property__owner",
                "reported_user",
                "reported_booking",
                "reported_by",
            )
        )


# ── Admin-only views ──────────────────────────────────────────────

class AdminReportListView(generics.ListAPIView):
    """
    GET /api/reports/admin/
    Admin can see all reports, filter by status.
    """
    serializer_class = ReportAdminSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = (
            Report.objects
            .select_related(
                "reported_by",
                "reported_property",
                "reported_property__owner",
                "reported_user",
                "reported_booking",
            )
            .all()
        )

        status_value = self.request.query_params.get("status")
        if status_value:
            qs = qs.filter(status=status_value)

        return qs


class AdminReportDetailView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/reports/admin/<id>/
    PATCH /api/reports/admin/<id>/
    Admin can view and update status / admin_notes.
    """
    serializer_class = ReportAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = Report.objects.select_related(
        "reported_by",
        "reported_property",
        "reported_property__owner",
        "reported_user",
        "reported_booking",
    ).all()