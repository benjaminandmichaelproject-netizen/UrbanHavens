from django.utils import timezone

from .models import Report


FLAG_THRESHOLD = 3
HIDE_THRESHOLD = 5


def evaluate_property_report_flags(property_obj):
    """
    Recalculate the report-based moderation state for a property.

    Rules:
    - Fewer than 3 unique valid reports -> active
    - 3 to 4 unique valid reports       -> flagged
    - 5 or more unique valid reports    -> hidden

    If the owner has already requested a recheck, the property remains
    in the "reviewing" state while the valid report count is still at
    or above the flag threshold. This prevents normal admin report
    updates from accidentally reverting "reviewing" back to "flagged"
    or "hidden".

    Resolved and dismissed reports do not count toward moderation.
    """

    valid_reports = (
        Report.objects.filter(
            reported_property=property_obj
        )
        .exclude(
            status__in=[
                "dismissed",
                "resolved",
            ]
        )
    )

    # Count each reporting user only once for this property.
    unique_report_count = (
        valid_reports.values("reported_by")
        .distinct()
        .count()
    )

    seen_users = set()
    category_counts = {}

    # Build the main reason summary using one report per user.
    for report in valid_reports.order_by(
        "reported_by",
        "-created_at",
    ):
        user_id = report.reported_by_id

        if user_id is not None:
            if user_id in seen_users:
                continue

            seen_users.add(user_id)

        category = report.category or "other"

        category_counts[category] = (
            category_counts.get(category, 0) + 1
        )

    sorted_reasons = sorted(
        category_counts.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    reason_summary = ", ".join(
        reason
        for reason, _ in sorted_reasons[:3]
    )

    # Read the persisted status before recalculating it.
    previous_status = (
        type(property_obj)
        .objects.filter(pk=property_obj.pk)
        .values_list(
            "report_flag_status",
            flat=True,
        )
        .first()
    )

    property_obj.reported_count = (
        unique_report_count
    )

    # Preserve an owner's active recheck request while the property
    # still has enough valid reports to require moderation.
    if (
        previous_status == "reviewing"
        and unique_report_count >= FLAG_THRESHOLD
    ):
        property_obj.report_flag_status = "reviewing"
        property_obj.report_flagged = True

        if not property_obj.report_flagged_at:
            property_obj.report_flagged_at = timezone.now()

        property_obj.report_flag_reason_summary = (
            reason_summary
        )

    # Five or more unique valid reports automatically hide the property.
    elif unique_report_count >= HIDE_THRESHOLD:
        property_obj.report_flag_status = "hidden"
        property_obj.report_flagged = True

        if not property_obj.report_flagged_at:
            property_obj.report_flagged_at = timezone.now()

        property_obj.report_flag_reason_summary = (
            reason_summary
        )

    # Three or four unique valid reports flag the property.
    elif unique_report_count >= FLAG_THRESHOLD:
        property_obj.report_flag_status = "flagged"
        property_obj.report_flagged = True

        if not property_obj.report_flagged_at:
            property_obj.report_flagged_at = timezone.now()

        property_obj.report_flag_reason_summary = (
            reason_summary
        )

    # Once fewer than three valid reports remain, restore the property.
    else:
        property_obj.report_flag_status = "active"
        property_obj.report_flagged = False
        property_obj.report_flagged_at = None
        property_obj.report_flag_reason_summary = ""

    property_obj.save(
        update_fields=[
            "reported_count",
            "report_flag_status",
            "report_flagged",
            "report_flagged_at",
            "report_flag_reason_summary",
        ]
    )

    return {
        "previous_status": previous_status,
        "current_status": property_obj.report_flag_status,
        "reported_count": unique_report_count,
        "reason_summary": reason_summary,
    }