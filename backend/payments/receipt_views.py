from decimal import Decimal

from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment


class PaymentReceiptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, payment_id):
        user = request.user
        role = getattr(user, "role", None)

        try:
            # Loads the payment and all receipt relationships efficiently.
            payment = Payment.objects.select_related(
                "tenant",
                "landlord",
                "property",
                "room",
                "booking",
            ).get(
                id=payment_id,
                status="success",
            )
        except Payment.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Successful payment receipt not found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Allows only the tenant, landlord, or administrator to view it.
        can_view_receipt = (
            user.is_superuser
            or role == "admin"
            or payment.tenant_id == user.id
            or payment.landlord_id == user.id
        )

        if not can_view_receipt:
            raise PermissionDenied(
                "You are not allowed to view this receipt."
            )

        # Prevents returning an incomplete receipt record.
        if not payment.receipt_number:
            return Response(
                {
                    "detail": (
                        "A receipt has not been generated for "
                        "this payment."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj = payment.property
        room_obj = payment.room
        tenant = payment.tenant
        landlord = payment.landlord

        # Uses the room price for hostels and property price for houses.
        monthly_rent = (
            room_obj.price_override
            if (
                room_obj
                and room_obj.price_override is not None
            )
            else property_obj.price
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

        # Provides the complete official receipt data.
        receipt_data = {
            "payment_id": payment.id,
            "receipt_number": payment.receipt_number,
            "payment_reference": str(payment.reference),
            "receipt_generated_at": (
                payment.receipt_generated_at
            ),
            "payment_date": (
                payment.verified_at
                or payment.receipt_generated_at
                or payment.created_at
            ),
            "tenant": {
                "id": tenant.id,
                "name": tenant_name,
                "email": tenant.email,
                "phone": getattr(tenant, "phone", None),
            },
            "landlord": {
                "id": landlord.id,
                "name": landlord_name,
                "email": landlord.email,
                "phone": getattr(landlord, "phone", None),
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
                    "room_number": room_obj.room_number,
                    "room_type": room_obj.room_type,
                    "gender_restriction": (
                        room_obj.gender_restriction
                    ),
                }
                if room_obj
                else None
            ),
            "payment": {
                "method": payment.payment_method,
                "method_display": (
                    payment.get_payment_method_display()
                ),
                "type": payment.payment_type,
                "type_display": (
                    payment.get_payment_type_display()
                ),
                "duration_months": payment.duration_months,
                "monthly_rent": str(
                    Decimal(str(monthly_rent)).quantize(
                        Decimal("0.01")
                    )
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
            },
            "settlement": {
                "status": payment.settlement_status,
                "status_display": (
                    payment.get_settlement_status_display()
                ),
                "platform_commission": str(
                    payment.platform_commission
                ),
                "paystack_fee": str(
                    payment.paystack_fee
                ),
                "owner_net_amount": str(
                    payment.owner_net_amount
                ),
            },
            "document": {
                "title": "Official Payment Receipt",
                "watermark": "URBANHAVENS",
                "watermark_opacity": 0.06,
            },
        }

        return Response(
            receipt_data,
            status=status.HTTP_200_OK,
        )