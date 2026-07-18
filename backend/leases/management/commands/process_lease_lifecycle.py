from django.core.management.base import BaseCommand

from leases.process_lease_lifecycle import process_lease_lifecycle


class Command(BaseCommand):
    """
    Runs the UrbanHavens lease lifecycle process manually or from a scheduler.
    """

    help = (
        "Processes lease expiry reminders, protected renewals, "
        "expired leases, property availability, and lifecycle SMS messages."
    )

    def handle(self, *args, **options):
        # Runs the complete lease lifecycle service.
        result = process_lease_lifecycle()

        reminders = result["reminders"]
        expiries = result["expiries"]

        self.stdout.write(
            self.style.SUCCESS(
                f"Lease lifecycle processed for {result['processed_date']}."
            )
        )

        self.stdout.write(
            "Reminders: "
            f"checked={reminders['checked']}, "
            f"sent={reminders['sent']}, "
            f"already_sent={reminders['already_sent']}, "
            f"sms_failures={reminders['sms_failures']}"
        )

        self.stdout.write(
            "Expiries: "
            f"checked={expiries['checked']}, "
            f"ended={expiries['ended']}, "
            f"blocked_by_renewal={expiries['blocked_by_renewal']}, "
            f"already_processed={expiries['already_processed']}, "
            f"release_warnings={expiries['release_warnings']}, "
            f"sms_failures={expiries['sms_failures']}"
        )