from django.utils import timezone
from .models import Report

FLAG_THRESHOLD = 3
HIDE_THRESHOLD = 5


def evaluate_property_report_flags(property_obj):
    """
    Recalculate report-based flag status for a property using
    unique users' reports, excluding dismissed and resolved reports.

    Rules:
    - < 3 unique valid reports   -> active
    - >= 3 and < 5               -> flagged
    - >= 5                       -> hidden

    When reports are resolved/dismissed and the count drops again,
    the property returns to active automatically.
    """

    valid_reports = (
        Report.objects.filter(reported_property=property_obj)
        .exclude(status__in=["dismissed", "resolved"])
    )

    unique_report_count = (
        valid_reports.values("reported_by").distinct().count()
    )

    seen_users = set()
    category_counts = {}

    for report in valid_reports.order_by("reported_by", "-created_at"):
        user_id = report.reported_by_id

        if user_id is not None:
            if user_id in seen_users:
                continue
            seen_users.add(user_id)

        category = report.category or "other"
        category_counts[category] = category_counts.get(category, 0) + 1

    sorted_reasons = sorted(
        category_counts.items(),
        key=lambda item: item[1],
        reverse=True,
    )
    reason_summary = ", ".join(reason for reason, _ in sorted_reasons[:3])

    previous_status = (
        type(property_obj)
        .objects.filter(pk=property_obj.pk)
        .values_list("report_flag_status", flat=True)
        .first()
    )

    property_obj.reported_count = unique_report_count

    if unique_report_count >= HIDE_THRESHOLD:
        property_obj.report_flag_status = "hidden"
        property_obj.report_flagged = True
        if not property_obj.report_flagged_at:
            property_obj.report_flagged_at = timezone.now()
        property_obj.report_flag_reason_summary = reason_summary

    elif unique_report_count >= FLAG_THRESHOLD:
        property_obj.report_flag_status = "flagged"
        property_obj.report_flagged = True
        if not property_obj.report_flagged_at:
            property_obj.report_flagged_at = timezone.now()
        property_obj.report_flag_reason_summary = reason_summary

    else:
        property_obj.report_flag_status = "active"
        property_obj.report_flagged = False
        property_obj.report_flagged_at = None
        property_obj.report_flag_reason_summary = ""

    property_obj.save(update_fields=[
        "reported_count",
        "report_flag_status",
        "report_flagged",
        "report_flagged_at",
        "report_flag_reason_summary",
    ])

    return {
        "previous_status": previous_status,
        "current_status": property_obj.report_flag_status,
        "reported_count": unique_report_count,
        "reason_summary": reason_summary,
    }