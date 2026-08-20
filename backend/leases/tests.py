from django.test import TestCase

# Create your tests here.
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from payments.models import Payment
from properties.models import ApartmentUnit, Property

from .models import LeaseRenewalRequest, TenantLease
from .process_lease_lifecycle import process_expired_leases


User = get_user_model()


class MultiUnitApartmentRegressionTests(TestCase):
    """
    Protects the exact-unit rental flow for multi-unit apartments.
    """

    def setUp(self):
        # Creates the minimum owner and tenant accounts needed by the
        # apartment, payment, lease, renewal, and lifecycle models.
        self.owner = User.objects.create_user(
            username="multiunit-owner",
            email="owner@example.com",
            password="TestPassword123!",
            role="owner",
        )
        self.tenant = User.objects.create_user(
            username="multiunit-tenant",
            email="tenant@example.com",
            password="TestPassword123!",
            role="tenant",
        )

        # The parent Property still carries temporary legacy values until
        # the later schema migration makes them optional for multi-unit ads.
        self.property = Property.objects.create(
            owner=self.owner,
            property_name="Regression Apartments",
            category="apartment",
            apartment_listing_type="multi_unit",
            bedrooms=1,
            bathrooms=1,
            price=Decimal("1000.00"),
            description="Multi-unit regression test property.",
            amenities=[],
            allowed_rental_months=[1, 3, 6, 12],
            region="Greater Accra",
            city="Accra",
            is_available=False,
            approval_status="approved",
        )

        # Unit A represents the tenant's exact rentable apartment.
        self.unit_a = ApartmentUnit.objects.create(
            property=self.property,
            unit_number="A1",
            bedrooms=2,
            bathrooms=2,
            floor="1",
            price=Decimal("1800.00"),
            status="occupied",
        )

        # Unit B proves that operations on Unit A do not affect another unit.
        self.unit_b = ApartmentUnit.objects.create(
            property=self.property,
            unit_number="B1",
            bedrooms=1,
            bathrooms=1,
            floor="1",
            price=Decimal("1500.00"),
            status="reserved",
        )

        self.property.refresh_from_db()

    def _create_active_lease(
        self,
        *,
        end_date=None,
    ):
        # Creates a valid active lease attached to Unit A only.
        start_date = timezone.localdate() - timedelta(days=20)
        end_date = end_date or (
            timezone.localdate() + timedelta(days=10)
        )

        return TenantLease.objects.create(
            booking=None,
            property=self.property,
            tenant=self.tenant,
            landlord=self.owner,
            room=None,
            apartment_unit=self.unit_a,
            lease_start_date=start_date,
            lease_end_date=end_date,
            move_in_date=start_date,
            monthly_rent=Decimal("1800.00"),
            deposit_amount=Decimal("0.00"),
            first_payment_status="paid",
            status="active",
        )

    def _create_renewal(
        self,
        lease,
        *,
        status="pending",
    ):
        # Creates a renewal that preserves the exact apartment unit.
        proposed_start = lease.lease_end_date + timedelta(days=1)
        proposed_end = proposed_start + timedelta(days=30)

        return LeaseRenewalRequest.objects.create(
            current_lease=lease,
            tenant=self.tenant,
            landlord=self.owner,
            property=self.property,
            room=None,
            apartment_unit=self.unit_a,
            requested_duration_months=1,
            proposed_start_date=proposed_start,
            proposed_end_date=proposed_end,
            monthly_rent=Decimal("1800.00"),
            expected_amount=Decimal("1800.00"),
            status=status,
        )

    def test_apartment_unit_status_syncs_parent_availability(self):
        # With no available unit, the multi-unit parent must stay unavailable.
        self.assertFalse(self.property.is_available)

        # Making one child unit available must make the parent discoverable.
        self.unit_a.status = "available"
        self.unit_a.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        self.property.refresh_from_db()
        self.assertTrue(self.property.is_available)

        # Occupying the last available unit must hide the parent again.
        self.unit_a.status = "occupied"
        self.unit_a.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        self.property.refresh_from_db()
        self.assertFalse(self.property.is_available)

    def test_lease_requires_the_exact_multi_unit_apartment(self):
        # A lease carrying Unit A is valid for this multi-unit property.
        lease = self._create_active_lease()
        lease.full_clean()

        # A multi-unit lease without an apartment unit must be rejected.
        invalid_lease = TenantLease(
            booking=None,
            property=self.property,
            tenant=self.tenant,
            landlord=self.owner,
            room=None,
            apartment_unit=None,
            lease_start_date=timezone.localdate(),
            lease_end_date=(
                timezone.localdate() + timedelta(days=30)
            ),
            move_in_date=timezone.localdate(),
            monthly_rent=Decimal("1800.00"),
            deposit_amount=Decimal("0.00"),
            first_payment_status="paid",
            status="active",
        )

        with self.assertRaises(ValidationError):
            invalid_lease.full_clean()

    def test_renewal_payment_must_keep_the_same_apartment_unit(self):
        # The renewal itself is bound to Unit A from the current lease.
        lease = self._create_active_lease()
        renewal = self._create_renewal(
            lease,
            status="payment_pending",
        )
        renewal.full_clean()

        # A renewal payment carrying the same exact unit must validate.
        valid_payment = Payment(
            tenant=self.tenant,
            landlord=self.owner,
            booking=None,
            renewal_request=renewal,
            property=self.property,
            room=None,
            apartment_unit=self.unit_a,
            payment_type="renewal",
            payment_method="direct",
            duration_months=1,
            amount=Decimal("1800.00"),
            expected_amount=Decimal("1800.00"),
            status="pending",
        )
        valid_payment.full_clean()

        # Switching the payment to another unit must be rejected.
        invalid_payment = Payment(
            tenant=self.tenant,
            landlord=self.owner,
            booking=None,
            renewal_request=renewal,
            property=self.property,
            room=None,
            apartment_unit=self.unit_b,
            payment_type="renewal",
            payment_method="direct",
            duration_months=1,
            amount=Decimal("1800.00"),
            expected_amount=Decimal("1800.00"),
            status="pending",
        )

        with self.assertRaises(ValidationError):
            invalid_payment.full_clean()

    @patch(
        "leases.process_lease_lifecycle._send_sms_helper_safely",
        return_value=True,
    )
    def test_expired_lease_releases_only_its_exact_unit(
        self,
        _mock_sms,
    ):
        # An expired lease without a protected renewal should release Unit A.
        expired_date = timezone.localdate() - timedelta(days=1)
        lease = self._create_active_lease(
            end_date=expired_date,
        )

        summary = process_expired_leases(
            today=timezone.localdate(),
        )

        lease.refresh_from_db()
        self.unit_a.refresh_from_db()
        self.unit_b.refresh_from_db()
        self.property.refresh_from_db()

        self.assertEqual(lease.status, "ended")
        self.assertEqual(self.unit_a.status, "available")

        # Unit B must remain untouched by Unit A's lease expiry.
        self.assertEqual(self.unit_b.status, "reserved")

        # The available Unit A makes the parent listing available again.
        self.assertTrue(self.property.is_available)
        self.assertEqual(summary["ended"], 1)

    @patch(
        "leases.process_lease_lifecycle._send_sms_helper_safely",
        return_value=True,
    )
    def test_protected_renewal_prevents_unit_release(
        self,
        _mock_sms,
    ):
        # A pending renewal must preserve the occupied unit even after the
        # original lease end date passes.
        expired_date = timezone.localdate() - timedelta(days=1)
        lease = self._create_active_lease(
            end_date=expired_date,
        )
        self._create_renewal(
            lease,
            status="pending",
        )

        summary = process_expired_leases(
            today=timezone.localdate(),
        )

        lease.refresh_from_db()
        self.unit_a.refresh_from_db()
        self.property.refresh_from_db()

        self.assertEqual(lease.status, "active")
        self.assertEqual(self.unit_a.status, "occupied")
        self.assertFalse(self.property.is_available)
        self.assertEqual(summary["blocked_by_renewal"], 1)
        self.assertEqual(summary["ended"], 0)