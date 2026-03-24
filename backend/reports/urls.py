from django.urls import path
from .views import (
    SubmitReportView,
    MyReportsView,
    AdminReportListView,
    AdminReportDetailView,
)

urlpatterns = [
    # User endpoints
    path("",            SubmitReportView.as_view(),  name="report-submit"),
    path("my-reports/", MyReportsView.as_view(),     name="report-my-list"),

    # Admin endpoints
    path("admin/",      AdminReportListView.as_view(),          name="report-admin-list"),
    path("admin/<int:pk>/", AdminReportDetailView.as_view(),    name="report-admin-detail"),
]