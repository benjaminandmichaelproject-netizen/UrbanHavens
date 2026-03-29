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
       report = serializer.save(reported_by=self.request.user)

       if report.reported_property:
        from .services import evaluate_property_report_flags
        from notifications.models import Notification

        result = evaluate_property_report_flags(report.reported_property)

        previous_status = result.get("previous_status")
        current_status = result.get("current_status")
        reason_summary = result.get("reason_summary") or "multiple user reports"

        property_obj = report.reported_property
        owner = getattr(property_obj, "owner", None)

        if owner and previous_status != current_status:
            if current_status == "flagged":
                Notification.objects.create(
                    recipient=owner,
                    message=(
                        f'Your property "{property_obj.property_name}" has been flagged '
                        f"after receiving multiple user reports. "
                        f"Main reasons: {reason_summary}. "
                        "Please review and update the listing details to resolve the issue."
                    ),
                    notification_type="property_flagged",
                    related_property_id=property_obj.id,
                )

            elif current_status == "hidden":
                Notification.objects.create(
                    recipient=owner,
                    message=(
                        f'Your property "{property_obj.property_name}" has been hidden '
                        f"after receiving multiple user reports. "
                        f"Main reasons: {reason_summary}. "
                        "Please review the listing, correct the reported issues, and request a recheck."
                    ),
                    notification_type="property_hidden",
                    related_property_id=property_obj.id,
                )
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

    def perform_update(self, serializer):
        report = serializer.save()

        if report.reported_property:
            from .services import evaluate_property_report_flags
            from notifications.models import Notification

            result = evaluate_property_report_flags(report.reported_property)

            previous_status = result.get("previous_status")
            current_status = result.get("current_status")
            reason_summary = result.get("reason_summary") or "multiple user reports"

            property_obj = report.reported_property
            owner = getattr(property_obj, "owner", None)

            if owner and previous_status != current_status:
                if current_status == "active":
                    Notification.objects.create(
                        recipient=owner,
                        message=(
                            f'Your property "{property_obj.property_name}" is active again. '
                            "The review has been completed and the property is now visible in listings."
                        ),
                        notification_type="property_approved",
                        related_property_id=property_obj.id,
                    )

                elif current_status == "flagged":
                    Notification.objects.create(
                        recipient=owner,
                        message=(
                            f'Your property "{property_obj.property_name}" remains flagged. '
                            f"Main reasons: {reason_summary}. "
                            "Please review and update the listing details."
                        ),
                        notification_type="property_flagged",
                        related_property_id=property_obj.id,
                    )

                elif current_status == "hidden":
                    Notification.objects.create(
                        recipient=owner,
                        message=(
                            f'Your property "{property_obj.property_name}" remains hidden after review. '
                            f"Main reasons: {reason_summary}. "
                            "Please correct the issues and request another recheck when ready."
                        ),
                        notification_type="property_hidden",
                        related_property_id=property_obj.id,
                    )