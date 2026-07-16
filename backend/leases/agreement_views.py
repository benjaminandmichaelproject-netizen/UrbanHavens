from decimal import Decimal

from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from payments.models import Payment

from .models import TenantLease


class TenancyAgreementView(APIView):
    # Requires authentication before agreement access.
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lease_id):
        user = request.user
        role = getattr(user, "role", None)

        try:
            # Loads the lease and related agreement data efficiently.
            lease = (
                TenantLease.objects.select_related(
                    "booking",
                    "property",
                    "tenant",
                    "landlord",
                    "room",
                )
                .prefetch_related(
                    "property__images",
                )
                .get(
                    id=lease_id,
                )
            )
        except TenantLease.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Tenancy agreement not found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Allows only the tenant, landlord, or administrator.
        can_view_agreement = (
            user.is_superuser
            or role == "admin"
            or lease.tenant_id == user.id
            or lease.landlord_id == user.id
        )

        if not can_view_agreement:
            raise PermissionDenied(
                "You are not allowed to view this tenancy agreement."
            )

        # Prevents incomplete agreement records from being returned.
        if not lease.agreement_number:
            return Response(
                {
                    "detail": (
                        "An agreement has not been generated "
                        "for this lease."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj = lease.property
        room_obj = lease.room
        tenant = lease.tenant
        landlord = lease.landlord

        # Loads the successful payment linked to the lease booking.
        payment = None

        if lease.booking_id:
            payment = (
                Payment.objects.filter(
                    booking_id=lease.booking_id,
                    status="success",
                )
                .select_related(
                    "room",
                    "property",
                )
                .first()
            )

        # Returns the safest readable tenant name.
        tenant_name = (
            tenant.get_full_name().strip()
            or tenant.username
            or tenant.email
        )

        # Returns the safest readable landlord name.
        landlord_name = (
            landlord.get_full_name().strip()
            or landlord.username
            or landlord.email
        )

        # Calculates the total rent for the complete lease period.
        duration_months = None

        if payment:
            duration_months = payment.duration_months

        total_rent = None

        if duration_months:
            total_rent = (
                Decimal(str(lease.monthly_rent))
                * Decimal(str(duration_months))
            ).quantize(
                Decimal("0.01")
            )

        # Returns the official tenancy agreement data.
        agreement_data = {
            "lease_id": lease.id,
            "agreement_number": (
                lease.agreement_number
            ),
            "agreement_generated_at": (
                lease.agreement_generated_at
            ),
            "lease_status": lease.status,
            "lease_status_display": (
                lease.get_status_display()
            ),
            "tenant": {
                "id": tenant.id,
                "name": tenant_name,
                "email": tenant.email,
                "phone": getattr(
                    tenant,
                    "phone",
                    None,
                ),
            },
            "landlord": {
                "id": landlord.id,
                "name": landlord_name,
                "email": landlord.email,
                "phone": getattr(
                    landlord,
                    "phone",
                    None,
                ),
            },
            "property": {
                "id": property_obj.id,
                "name": property_obj.property_name,
                "category": property_obj.category,
                "type": property_obj.property_type,
                "city": property_obj.city,
                "region": property_obj.region,
            },
            "room": (
                {
                    "id": room_obj.id,
                    "room_number": (
                        room_obj.room_number
                    ),
                    "room_type": (
                        room_obj.room_type
                    ),
                    "gender_restriction": (
                        room_obj.gender_restriction
                    ),
                }
                if room_obj
                else None
            ),
            "lease": {
                "start_date": (
                    lease.lease_start_date
                ),
                "end_date": (
                    lease.lease_end_date
                ),
                "move_in_date": (
                    lease.move_in_date
                ),
                "duration_months": (
                    duration_months
                ),
                "monthly_rent": str(
                    lease.monthly_rent
                ),
                "total_rent": (
                    str(total_rent)
                    if total_rent is not None
                    else None
                ),
                "deposit_amount": str(
                    lease.deposit_amount
                ),
                "first_payment_status": (
                    lease.first_payment_status
                ),
                "first_payment_status_display": (
                    lease.get_first_payment_status_display()
                ),
                "notes": lease.notes or "",
            },
            "payment": (
                {
                    "id": payment.id,
                    "reference": str(
                        payment.reference
                    ),
                    "method": (
                        payment.payment_method
                    ),
                    "method_display": (
                        payment.get_payment_method_display()
                    ),
                    "expected_amount": str(
                        payment.expected_amount
                    ),
                    "amount_received": str(
                        payment.amount_received
                    ),
                    "completion_status": (
                        payment.payment_completion_status
                    ),
                    "completion_status_display": (
                        payment
                        .get_payment_completion_status_display()
                    ),
                    "outstanding_balance": str(
                        payment.outstanding_balance
                    ),
                    "receipt_number": (
                        payment.receipt_number
                    ),
                }
                if payment
                else None
            ),
            "terms": {
                "rent_due": (
                    "Rent must be paid according to the "
                    "agreed payment schedule."
                ),
                "property_use": (
                    "The property must be used only for "
                    "the agreed residential purpose."
                ),
                "maintenance": (
                    "The tenant must keep the property "
                    "reasonably clean and report damage promptly."
                ),
                "alterations": (
                    "The tenant must not make structural "
                    "alterations without the landlord's consent."
                ),
                "termination": (
                    "Termination must follow the notice "
                    "period and conditions agreed by both parties."
                ),
            },
            "document": {
                "title": (
                    "Official Tenancy Agreement"
                ),
                "watermark": "URBANHAVENS",
                "watermark_opacity": 0.06,
            },
        }

        return Response(
            agreement_data,
            status=status.HTTP_200_OK,
        )