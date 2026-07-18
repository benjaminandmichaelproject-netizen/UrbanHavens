from django.db import transaction
from django.utils import timezone

from notifications.sms import (
    send_landlord_lease_expired_sms,
    send_landlord_lease_expiry_reminder_sms,
    send_landlord_renewal_protection_sms,
    send_tenant_lease_expired_sms,
    send_tenant_lease_expiry_reminder_sms,
    send_tenant_renewal_protection_sms,
)

from .models import (
    LeaseLifecycleEvent,
    LeaseRenewalRequest,
    TenantLease,
)


# Renewal states that must keep the property or hostel space reserved.
PROTECTED_RENEWAL_STATUSES = [
    "pending",
    "payment_pending",
    "payment_completed",
    "approved",
]


# Maps reminder days to their lifecycle event types.
REMINDER_EVENT_TYPES = {
    30: "expiry_30_day_reminder",
    14: "expiry_14_day_reminder",
    7: "expiry_7_day_reminder",
}


def _send_sms_helper_safely(
    sms_helper,
    *args,
):
    """
    Calls a lease SMS helper without allowing SMS failure to
    reverse lease lifecycle processing.
    """
    try:
        result = sms_helper(*args)

        # A None result means the recipient has no phone number.
        return result is not None
    except Exception as exc:
        print(
            "LEASE LIFECYCLE SMS FAILED:",
            repr(exc),
            flush=True,
        )
        return False


def _get_protected_renewal(lease):
    """
    Returns the newest renewal that should prevent automatic
    lease expiry and property release.
    """
    return (
        LeaseRenewalRequest.objects.filter(
            current_lease=lease,
            status__in=PROTECTED_RENEWAL_STATUSES,
        )
        .order_by("-created_at")
        .first()
    )


def _record_lifecycle_event(
    *,
    lease,
    event_type,
    message,
    renewal_request=None,
    metadata=None,
):
    """
    Records a lifecycle event once and returns whether it was new.
    """
    event, created = LeaseLifecycleEvent.objects.get_or_create(
        lease=lease,
        event_type=event_type,
        defaults={
            "renewal_request": renewal_request,
            "message": message,
            "metadata": metadata or {},
        },
    )

    return event, created


def send_lease_expiry_reminders(today=None):
    """
    Sends the 30-day, 14-day, and 7-day lease expiry reminders.

    The lifecycle event constraint prevents the same reminder
    from being sent more than once for a lease.
    """
    today = today or timezone.localdate()

    summary = {
        "checked": 0,
        "sent": 0,
        "already_sent": 0,
        "sms_failures": 0,
    }

    leases = (
        TenantLease.objects.filter(
            status="active",
            lease_end_date__gte=today,
        )
        .select_related(
            "tenant",
            "landlord",
            "property",
            "room",
        )
        .order_by("lease_end_date")
    )

    for lease in leases:
        days_remaining = (
            lease.lease_end_date - today
        ).days

        if days_remaining not in REMINDER_EVENT_TYPES:
            continue

        summary["checked"] += 1

        event_type = REMINDER_EVENT_TYPES[
            days_remaining
        ]

        room_text = (
            f", Room {lease.room.room_number}"
            if lease.room_id
            else ""
        )

        event_message = (
            f"Lease #{lease.id} for "
            f"{lease.property.property_name}{room_text} "
            f"expires in {days_remaining} days on "
            f"{lease.lease_end_date}."
        )

        _, created = _record_lifecycle_event(
            lease=lease,
            event_type=event_type,
            message=event_message,
            metadata={
                "days_remaining": days_remaining,
                "lease_end_date": str(
                    lease.lease_end_date
                ),
                "property_id": lease.property_id,
                "room_id": lease.room_id,
            },
        )

        if not created:
            summary["already_sent"] += 1
            continue

        tenant_sent = _send_sms_helper_safely(
            send_tenant_lease_expiry_reminder_sms,
            lease,
            days_remaining,
        )

        landlord_sent = _send_sms_helper_safely(
            send_landlord_lease_expiry_reminder_sms,
            lease,
            days_remaining,
        )

        summary["sent"] += 1

        if not tenant_sent:
            summary["sms_failures"] += 1

        if not landlord_sent:
            summary["sms_failures"] += 1

    return summary


def _release_expired_lease_space(lease):
    """
    Releases the house or one occupied hostel space after a lease
    ends, while preserving the existing room availability logic.
    """
    property_obj = lease.property

    if property_obj.category == "hostel":
        if not lease.room_id:
            return {
                "released": False,
                "release_type": "hostel",
                "reason": "Lease has no assigned hostel room.",
            }

        # Locks the room so two lifecycle runs cannot release
        # the same occupied space at the same time.
        room = (
            lease.room.__class__.objects
            .select_for_update()
            .get(pk=lease.room_id)
        )

        if room.occupied_spaces > 0:
            room.occupied_spaces -= 1

            # Room.save() recalculates room availability and
            # synchronizes the parent hostel automatically.
            room.save(
                update_fields=[
                    "occupied_spaces",
                    "is_available",
                    "updated_at",
                ]
            )

            return {
                "released": True,
                "release_type": "hostel_space",
                "room_id": room.id,
                "occupied_spaces": room.occupied_spaces,
                "reserved_spaces": room.reserved_spaces,
                "is_available": room.is_available,
            }

        return {
            "released": False,
            "release_type": "hostel_space",
            "room_id": room.id,
            "reason": "Room has no occupied space to release.",
        }

    # Prevents a house from becoming available while another
    # active lease still exists for it.
    another_active_lease_exists = (
        TenantLease.objects.filter(
            property=property_obj,
            status="active",
        )
        .exclude(pk=lease.pk)
        .exists()
    )

    if another_active_lease_exists:
        return {
            "released": False,
            "release_type": "house",
            "reason": (
                "Another active lease still exists "
                "for this property."
            ),
        }

    if not property_obj.is_available:
        property_obj.is_available = True
        property_obj.save(
            update_fields=[
                "is_available",
                "updated_at",
            ]
        )

    return {
        "released": True,
        "release_type": "house",
        "property_id": property_obj.id,
        "is_available": property_obj.is_available,
    }


def process_expired_leases(today=None):
    """
    Ends leases whose end date has passed unless a protected
    renewal request still exists.

    Protected renewals keep the house or hostel space unavailable.
    """
    today = today or timezone.localdate()

    summary = {
        "checked": 0,
        "ended": 0,
        "blocked_by_renewal": 0,
        "already_processed": 0,
        "release_warnings": 0,
        "sms_failures": 0,
    }

    lease_ids = list(
        TenantLease.objects.filter(
            status="active",
            lease_end_date__lt=today,
        ).values_list(
            "id",
            flat=True,
        )
    )

    for lease_id in lease_ids:
        sms_payload = None

        with transaction.atomic():
            try:
                lease = (
                    TenantLease.objects
                    .select_for_update()
                    .select_related(
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                    )
                    .get(
                        id=lease_id,
                    )
                )
            except TenantLease.DoesNotExist:
                continue

            if (
                lease.status != "active"
                or lease.lease_end_date >= today
            ):
                summary["already_processed"] += 1
                continue

            summary["checked"] += 1

            protected_renewal = (
                _get_protected_renewal(lease)
            )

            if protected_renewal:
                event_message = (
                    f"Automatic expiry for Lease #{lease.id} "
                    f"was blocked because renewal request "
                    f"#{protected_renewal.id} is currently "
                    f"{protected_renewal.status}."
                )

                _, created = _record_lifecycle_event(
                    lease=lease,
                    renewal_request=protected_renewal,
                    event_type=(
                        "expiry_blocked_by_renewal"
                    ),
                    message=event_message,
                    metadata={
                        "lease_end_date": str(
                            lease.lease_end_date
                        ),
                        "renewal_id": (
                            protected_renewal.id
                        ),
                        "renewal_status": (
                            protected_renewal.status
                        ),
                    },
                )

                if created:
                    summary[
                        "blocked_by_renewal"
                    ] += 1

                    sms_payload = {
                        "type": "blocked",
                        "lease": lease,
                        "renewal": protected_renewal,
                    }
                else:
                    summary[
                        "already_processed"
                    ] += 1

            else:
                # Marks the expired lease as ended before checking
                # for other active leases on the same property.
                TenantLease.objects.filter(
                    pk=lease.pk,
                    status="active",
                ).update(
                    status="ended",
                )
                lease.status = "ended"

                release_result = (
                    _release_expired_lease_space(
                        lease
                    )
                )

                event_message = (
                    f"Lease #{lease.id} expired on "
                    f"{lease.lease_end_date} and was "
                    f"automatically marked as ended."
                )

                _, created = _record_lifecycle_event(
                    lease=lease,
                    event_type="lease_expired",
                    message=event_message,
                    metadata={
                        "lease_end_date": str(
                            lease.lease_end_date
                        ),
                        "processed_date": str(today),
                        "property_id": lease.property_id,
                        "room_id": lease.room_id,
                        "release": release_result,
                    },
                )

                if created:
                    summary["ended"] += 1
                else:
                    summary[
                        "already_processed"
                    ] += 1

                if not release_result.get(
                    "released"
                ):
                    summary[
                        "release_warnings"
                    ] += 1

                sms_payload = {
                    "type": "ended",
                    "lease": lease,
                    "release": release_result,
                }

        if not sms_payload:
            continue

        lease = sms_payload["lease"]

        room_text = (
            f", Room {lease.room.room_number}"
            if lease.room_id
            else ""
        )

        if sms_payload["type"] == "blocked":
            renewal = sms_payload[
                "renewal"
            ]

            tenant_sent = _send_sms_helper_safely(
                send_tenant_renewal_protection_sms,
                lease,
                renewal,
            )

            landlord_sent = _send_sms_helper_safely(
                send_landlord_renewal_protection_sms,
                lease,
                renewal,
            )

        else:
            tenant_sent = _send_sms_helper_safely(
                send_tenant_lease_expired_sms,
                lease,
            )

            landlord_sent = _send_sms_helper_safely(
                send_landlord_lease_expired_sms,
                lease,
            )

        if not tenant_sent:
            summary[
                "sms_failures"
            ] += 1

        if not landlord_sent:
            summary[
                "sms_failures"
            ] += 1

    return summary


def process_lease_lifecycle(today=None):
    """
    Runs all lease lifecycle automation and returns a summary.

    This public function can later be called by a cron job,
    Celery task, scheduled endpoint, or management command.
    """
    today = today or timezone.localdate()

    reminder_summary = (
        send_lease_expiry_reminders(
            today=today
        )
    )

    expiry_summary = (
        process_expired_leases(
            today=today
        )
    )

    return {
        "processed_date": str(today),
        "reminders": reminder_summary,
        "expiries": expiry_summary,
    }