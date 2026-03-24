from django.db import models

# Create your models here.
from django.db import models
from django.conf import settings


class Report(models.Model):

    CATEGORY_CHOICES = [
        ("fraudulent_listing",   "Fraudulent or fake listing"),
        ("misleading_info",      "Misleading property information"),
        ("inappropriate_content","Inappropriate content or photos"),
        ("scam",                 "Suspected scam or fraud"),
        ("wrong_price",          "Incorrect pricing"),
        ("already_rented",       "Property already rented"),
        ("harassment",           "Harassment or abuse"),
        ("other",                "Other"),
    ]

    STATUS_CHOICES = [
        ("pending",    "Pending"),
        ("reviewing",  "Under Review"),
        ("resolved",   "Resolved"),
        ("dismissed",  "Dismissed"),
    ]

    # Who filed the report
    reported_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reports_filed",
    )

    # What is being reported (all optional — use whichever applies)
    reported_property = models.ForeignKey(
        "properties.Property",          # adjust to your actual app label
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reports",
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reports_against",
    )
    reported_booking = models.ForeignKey(
        "bookings.Booking",             # adjust to your actual app label
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reports",
    )

    # Report details
    category      = models.CharField(max_length=40, choices=CATEGORY_CHOICES)
    subject       = models.CharField(max_length=120)
    description   = models.TextField()
    contact_email = models.EmailField(blank=True)

    # Admin tracking
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    admin_notes   = models.TextField(blank=True)
    resolved_at   = models.DateTimeField(null=True, blank=True)

    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Report"
        verbose_name_plural = "Reports"

    def __str__(self):
        return f"[{self.get_status_display()}] {self.subject} — by {self.reported_by}"