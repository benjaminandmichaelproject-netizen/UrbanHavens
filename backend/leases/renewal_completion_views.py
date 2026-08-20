from django.db import transaction
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import send_notification
from properties.models import ApartmentUnit

from .models import (
    LeaseRenewalRequest,
    TenantLease,
)
from .serializers import TenantLeaseSerializer


class CompleteLeaseRenewalView(APIView):
    # Requires an authenticated property owner or administrator.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, renewal_id):
        user = request.user
        role = getattr(user, "role", None)

        # Restricts renewal completion to owners and administrators.
        if not (
            user.is_superuser
            or role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only the property owner can complete "
                "a lease renewal."
            )

        with transaction.atomic():
            try:
                # Locks the renewal and related records against duplicates.
                renewal = (
                    LeaseRenewalRequest.objects
                    .select_for_update()
                    .select_related(
                        "current_lease",
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                        "apartment_unit",
                    )
                    .get(
                        id=renewal_id,
                    )
                )
            except LeaseRenewalRequest.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "Lease renewal request not found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Prevents one owner from completing another owner's renewal.
            if not (
                user.is_superuser
                or role == "admin"
                or renewal.landlord_id == user.id
            ):
                raise PermissionDenied(
                    "You cannot complete another owner's "
                    "lease renewal."
                )

            # Requires successful renewal payment first.
            if renewal.status != "payment_completed":
                return Response(
                    {
                        "detail": (
                            "Only a fully processed renewal payment "
                            "can be completed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                # Loads and locks the payment linked to the renewal.
                payment = (
                    renewal.renewal_payment.__class__.objects
                    .select_for_update()
                    .select_related(
                        "property",
                        "room",
                        "apartment_unit",
                    )
                    .get(
                        pk=renewal.renewal_payment.pk,
                    )
                )
            except Exception:
                return Response(
                    {
                        "detail": (
                            "No renewal payment is linked to "
                            "this request."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Requires a successful payment record.
            if payment.status != "success":
                return Response(
                    {
                        "detail": (
                            "The renewal payment has not been "
                            "confirmed successfully."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Requires full payment before creating the renewed lease.
            if payment.payment_completion_status not in [
                "full",
                "overpaid",
            ]:
                return Response(
                    {
                        "detail": (
                            "The renewal cannot be completed while "
                            "an outstanding balance remains."
                        ),
                        "outstanding_balance": str(
                            payment.outstanding_balance
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Locks the lease currently being renewed.
            try:
                current_lease = (
                    TenantLease.objects
                    .select_for_update()
                    .select_related(
                        "property",
                        "tenant",
                        "landlord",
                        "room",
                    )
                    .get(
                        pk=renewal.current_lease_id,
                    )
                )
            except TenantLease.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "The current lease no longer exists."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Confirms the renewal still matches the original lease.
            relationships_match = (
                current_lease.tenant_id
                == renewal.tenant_id
                and current_lease.landlord_id
                == renewal.landlord_id
                and current_lease.property_id
                == renewal.property_id
                and current_lease.room_id
                == renewal.room_id
                and current_lease.apartment_unit_id
                == renewal.apartment_unit_id
            )

            if not relationships_match:
                return Response(
                    {
                        "detail": (
                            "The renewal request no longer matches "
                            "the current lease."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Confirms the successful payment still belongs to this
            # exact renewal, property, room or apartment unit.
            payment_matches = (
                payment.renewal_request_id == renewal.id
                and payment.tenant_id == renewal.tenant_id
                and payment.landlord_id == renewal.landlord_id
                and payment.property_id == renewal.property_id
                and payment.room_id == renewal.room_id
                and payment.apartment_unit_id
                == renewal.apartment_unit_id
                and payment.duration_months
                == renewal.requested_duration_months
                and payment.amount == renewal.expected_amount
            )

            if not payment_matches:
                return Response(
                    {
                        "detail": (
                            "The renewal payment no longer matches "
                            "this renewal request."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Prevents completing the renewal before its start date.
            today = timezone.localdate()

            if today < renewal.proposed_start_date:
                return Response(
                    {
                        "detail": (
                            "The renewed lease cannot become active "
                            "before its proposed start date."
                        ),
                        "renewal_start_date": (
                            renewal.proposed_start_date
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents duplicate completion of the same renewal.
            if renewal.status == "approved":
                return Response(
                    {
                        "detail": (
                            "This renewal has already been completed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            is_multi_unit_apartment = (
                renewal.property.category == "apartment"
                and renewal.property.apartment_listing_type == "multi_unit"
            )

            if renewal.property.category == "hostel":
                # Hostel renewal keeps the exact current room.
                if not renewal.room_id:
                    return Response(
                        {
                            "detail": (
                                "A hostel renewal requires the "
                                "tenant's current room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if renewal.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "A hostel renewal cannot contain "
                                "an apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if (
                    renewal.room.property_id
                    != renewal.property_id
                ):
                    return Response(
                        {
                            "detail": (
                                "The renewal room does not belong "
                                "to the selected hostel."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Preserves the existing rule that the same tenant cannot
                # hold another active lease for this hostel simultaneously.
                duplicate_active_lease = (
                    TenantLease.objects
                    .select_for_update()
                    .filter(
                        tenant=renewal.tenant,
                        property=renewal.property,
                        status="active",
                    )
                    .exclude(
                        id=current_lease.id,
                    )
                    .exists()
                )

                if duplicate_active_lease:
                    return Response(
                        {
                            "detail": (
                                "Another active lease already exists "
                                "for this tenant and property."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            elif is_multi_unit_apartment:
                # Multi-unit renewal keeps the exact apartment already
                # occupied by the current lease.
                if not renewal.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "A multi-unit apartment renewal requires "
                                "the tenant's current apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if renewal.room_id:
                    return Response(
                        {
                            "detail": (
                                "A multi-unit apartment renewal cannot "
                                "contain a hostel room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    locked_apartment_unit = (
                        ApartmentUnit.objects
                        .select_for_update()
                        .get(
                            pk=renewal.apartment_unit_id,
                            property=renewal.property,
                        )
                    )
                except ApartmentUnit.DoesNotExist:
                    return Response(
                        {
                            "detail": (
                                "The renewal apartment unit is invalid."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if locked_apartment_unit.status != "occupied":
                    return Response(
                        {
                            "detail": (
                                "The apartment unit must still be occupied "
                                "by the current lease before renewal "
                                "completion."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                another_unit_lease = (
                    TenantLease.objects
                    .select_for_update()
                    .filter(
                        apartment_unit=locked_apartment_unit,
                        status="active",
                    )
                    .exclude(
                        id=current_lease.id,
                    )
                    .exists()
                )

                if another_unit_lease:
                    return Response(
                        {
                            "detail": (
                                "Another active lease already exists "
                                "for this apartment unit."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            else:
                # Houses and single apartments are rented directly from
                # the parent Property, so only one active lease may exist.
                if renewal.room_id or renewal.apartment_unit_id:
                    return Response(
                        {
                            "detail": (
                                "This rental cannot contain a room "
                                "or apartment unit."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                another_parent_lease = (
                    TenantLease.objects
                    .select_for_update()
                    .filter(
                        property=renewal.property,
                        status="active",
                    )
                    .exclude(
                        id=current_lease.id,
                    )
                    .exists()
                )

                if another_parent_lease:
                    return Response(
                        {
                            "detail": (
                                "Another active lease already exists "
                                "for this property."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            # Ends the historical lease without changing occupancy.
            current_lease.status = "ended"

            current_notes = current_lease.notes or ""

            current_lease.notes = (
                f"{current_notes}\n"
                f"[Renewed] Continued under renewal "
                f"request #{renewal.id}."
            ).strip()

            current_lease.save(
                update_fields=[
                    "status",
                    "notes",
                ]
            )

            # Creates a fresh lease and agreement for the renewed period.
            new_lease = TenantLease.objects.create(
                booking=None,
                property=renewal.property,
                tenant=renewal.tenant,
                landlord=renewal.landlord,
                room=renewal.room,
                apartment_unit=renewal.apartment_unit,
                lease_start_date=(
                    renewal.proposed_start_date
                ),
                lease_end_date=(
                    renewal.proposed_end_date
                ),
                move_in_date=(
                    renewal.proposed_start_date
                ),
                monthly_rent=renewal.monthly_rent,
                deposit_amount=0,
                first_payment_status="paid",
                notes=(
                    f"Renewal of lease "
                    f"#{current_lease.id}. "
                    f"Renewal request #{renewal.id}. "
                    f"Payment receipt: "
                    f"{payment.receipt_number or 'N/A'}."
                ),
                status="active",
            )

            # Marks the renewal workflow as completed.
            renewal.status = "approved"
            renewal.approved_at = timezone.now()

            renewal.save(
                update_fields=[
                    "status",
                    "approved_at",
                    "updated_at",
                ]
            )

            # Houses and single apartments remain unavailable while
            # the renewed active lease continues.
            if (
                renewal.property.category != "hostel"
                and not is_multi_unit_apartment
            ):
                renewal.property.is_available = False
                renewal.property.save(
                    update_fields=[
                        "is_available",
                    ]
                )

            # Hostel room occupancy and multi-unit apartment occupancy
            # remain unchanged during renewal because the same tenant
            # continues occupying the same rentable resource.

        try:
            # Notifies the tenant about the completed renewal.
            send_notification(
                user=renewal.tenant,
                message=(
                    f"Your lease for "
                    f"{renewal.property.property_name} "
                    f"has been renewed successfully. "
                    f"New period: "
                    f"{new_lease.lease_start_date} to "
                    f"{new_lease.lease_end_date}. "
                    f"Agreement number: "
                    f"{new_lease.agreement_number}."
                ),
                notification_type="lease_renewed",
                property_id=renewal.property_id,
            )
        except Exception as exc:
            # Prevents notification failure from reversing renewal.
            print(
                "LEASE RENEWAL COMPLETION "
                "NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Lease renewal completed successfully. "
                    "A new lease and tenancy agreement "
                    "have been generated."
                ),
                "renewal_id": renewal.id,
                "renewal_status": renewal.status,
                "previous_lease_id": current_lease.id,
                "new_lease": TenantLeaseSerializer(
                    new_lease,
                    context={
                        "request": request,
                    },
                ).data,
                "payment": {
                    "id": payment.id,
                    "reference": payment.reference,
                    "receipt_number": (
                        payment.receipt_number
                    ),
                    "amount_received": str(
                        payment.amount_received
                    ),
                    "payment_status": (
                        payment.payment_completion_status
                    ),
                },
            },
            status=status.HTTP_201_CREATED,
        )