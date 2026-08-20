from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from system_logs.logger import log_property_event

from .models import (
    ApartmentUnit,
    ExternalLandlord,
    Favorite,
    Property,
    Room,
)
from .pagination import PropertyPagination
from .serializers import (
    ApartmentUnitSerializer,
    ExternalLandlordSerializer,
    FavoriteSerializer,
    PropertySerializer,
    RegisteredLandlordSerializer,
    RoomSerializer,
)

User = get_user_model()


class IsOwnerOrAdmin(permissions.BasePermission):
    # Allows safe reads while restricting changes to owners and admins.
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user

        if not user or not user.is_authenticated:
            return False

        if (
            user.is_superuser
            or getattr(user, "role", None) == "admin"
        ):
            return True

        return obj.owner_id == user.id


class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    pagination_class = PropertyPagination
    queryset = Property.objects.none()

    # Returns whether the current user has administrative access.
    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or getattr(user, "role", None) == "admin"
            )
        )

    # Loads all related data required by the property serializer
    # without repeatedly querying rooms, apartment units or images.
    def _base_queryset(self):
        return (
            Property.objects.select_related(
                "owner",
                "external_landlord",
                "approved_by",
            )
            .prefetch_related(
                "images",
                "rooms",
                "apartment_units",
            )
            .order_by("-id")
        )

    def get_queryset(self):
        queryset = self._base_queryset()

        user = (
            self.request.user
            if hasattr(self.request, "user")
            else None
        )

        # Public listings expose only approved and active properties.
        if self.action in ["list", "featured"]:
            queryset = queryset.filter(
                approval_status="approved",
                report_flag_status="active",
            )

            category = self.request.query_params.get(
                "category"
            )

            if category:
                queryset = queryset.filter(
                    category=category
                )

            is_available = self.request.query_params.get(
                "is_available"
            )

            if is_available is not None:
                queryset = queryset.filter(
                    is_available=(
                        is_available.lower() == "true"
                    )
                )

            return queryset

        # Retrieve uses the custom access checks below so owners and
        # admins can still inspect their non-public properties.
        if self.action == "retrieve":
            return queryset

        if self.action == "my_properties":
            if not user or not user.is_authenticated:
                return queryset.none()

            if getattr(user, "role", None) == "owner":
                return queryset.filter(owner=user)

            if self._is_admin(user):
                return queryset

            return queryset.none()

        if self.action == "admin_list":
            if self._is_admin(user):
                return queryset

            return queryset.none()

        if self._is_admin(user):
            return queryset

        if (
            user
            and user.is_authenticated
            and getattr(user, "role", None) == "owner"
        ):
            return queryset.filter(owner=user)

        return queryset.none()

    def get_permissions(self):
        # Public users may browse approved properties.
        if self.action in [
            "list",
            "retrieve",
            "featured",
        ]:
            return [AllowAny()]

        # Property submission and owner-property lists require login.
        if self.action in [
            "create",
            "my_properties",
        ]:
            return [permissions.IsAuthenticated()]

        # All management actions require authentication.
        if self.action in [
            "update",
            "partial_update",
            "destroy",
            "admin_list",
            "approve",
            "reject",
            "feature",
            "unfeature",
        ]:
            return [permissions.IsAuthenticated()]

        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        property_obj = serializer.save()

        try:
            log_property_event(
                message=(
                    f"Property created: "
                    f"{property_obj.property_name}"
                ),
                status="success",
                user=self.request.user,
                detail=(
                    f"Category: {property_obj.category}, "
                    f"Type: {property_obj.property_type}, "
                    f"City: {property_obj.city}, "
                    f"Approval: "
                    f"{property_obj.approval_status}"
                ),
                endpoint=self.request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

    # Passes the HTTP request into serializers so absolute media URLs
    # and request-aware behaviour continue working.
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request

        return context

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # Hidden properties remain invisible to the public.
        if instance.report_flag_status == "hidden":
            if not user or not user.is_authenticated:
                return Response(
                    {"detail": "Not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if self._is_admin(user):
                return Response(
                    self.get_serializer(instance).data
                )

            if (
                getattr(user, "role", None) == "owner"
                and instance.owner_id == user.id
            ):
                return Response(
                    self.get_serializer(instance).data
                )

            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Pending and rejected properties remain visible only to
        # their owner or an administrator.
        if instance.approval_status != "approved":
            if not user or not user.is_authenticated:
                return Response(
                    {"detail": "Not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if self._is_admin(user):
                return Response(
                    self.get_serializer(instance).data
                )

            if (
                getattr(user, "role", None) == "owner"
                and instance.owner_id == user.id
            ):
                return Response(
                    self.get_serializer(instance).data
                )

            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            self.get_serializer(instance).data
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="my-properties",
    )
    def my_properties(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)

        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(
                    page,
                    many=True,
                ).data
            )

        return Response(
            self.get_serializer(
                queryset,
                many=True,
            ).data
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="admin-list",
    )
    def admin_list(self, request):
        if not self._is_admin(request.user):
            return Response(
                {
                    "detail": (
                        "Only admins can view all properties."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)

        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(
                    page,
                    many=True,
                ).data
            )

        return Response(
            self.get_serializer(
                queryset,
                many=True,
            ).data
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="featured",
        permission_classes=[AllowAny],
    )
    def featured(self, request):
        queryset = (
            Property.objects.filter(
                approval_status="approved",
                is_featured=True,
                report_flag_status="active",
            )
            .select_related(
                "owner",
                "external_landlord",
                "approved_by",
            )
            .prefetch_related(
                "images",
                "rooms",
                "apartment_units",
            )
            .order_by("-updated_at")[:6]
        )

        return Response(
            self.get_serializer(
                queryset,
                many=True,
            ).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
    )
    def approve(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {
                    "detail": (
                        "Only admins can approve properties."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()

        property_obj.approval_status = "approved"
        property_obj.approved_by = request.user
        property_obj.approved_at = timezone.now()

        # Hostel availability depends on available room spaces.
        if property_obj.category == "hostel":
            property_obj.sync_availability()

        # A multi-unit apartment is available only when at least
        # one individual apartment unit is still available.
        elif (
            property_obj.category == "apartment"
            and property_obj.apartment_listing_type
            == "multi_unit"
        ):
            property_obj.sync_availability()

        # Houses and single apartments are rented as one complete
        # property, so approval makes them available normally.
        else:
            property_obj.is_available = True

        property_obj.save(
            update_fields=[
                "approval_status",
                "is_available",
                "approved_by",
                "approved_at",
            ]
        )

        try:
            log_property_event(
                message=(
                    f"Property approved: "
                    f"{property_obj.property_name}"
                ),
                status="success",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id}, "
                    f"Category: {property_obj.category}, "
                    f"Available: "
                    f"{property_obj.is_available}"
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {
                    "detail": (
                        "Only admins can reject properties."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()

        property_obj.approval_status = "rejected"
        property_obj.is_available = False
        property_obj.is_featured = False
        property_obj.approved_by = None
        property_obj.approved_at = None

        property_obj.save(
            update_fields=[
                "approval_status",
                "is_available",
                "is_featured",
                "approved_by",
                "approved_at",
            ]
        )

        try:
            log_property_event(
                message=(
                    f"Property rejected: "
                    f"{property_obj.property_name}"
                ),
                status="failure",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id} "
                    "was rejected by admin."
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="feature",
    )
    def feature(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {
                    "detail": (
                        "Only admins can feature properties."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()

        if property_obj.approval_status != "approved":
            return Response(
                {
                    "detail": (
                        "Only approved properties "
                        "can be featured."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj.is_featured = True

        property_obj.save(
            update_fields=["is_featured"]
        )

        try:
            log_property_event(
                message=(
                    f"Property featured: "
                    f"{property_obj.property_name}"
                ),
                status="info",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id} "
                    "marked as featured."
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="unfeature",
    )
    def unfeature(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {
                    "detail": (
                        "Only admins can unfeature properties."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()
        property_obj.is_featured = False

        property_obj.save(
            update_fields=["is_featured"]
        )

        try:
            log_property_event(
                message=(
                    f"Property unfeatured: "
                    f"{property_obj.property_name}"
                ),
                status="info",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id} "
                    "removed from featured list."
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="request-recheck",
    )
    def request_recheck(self, request, pk=None):
        property_obj = self.get_object()
        user = request.user

        if not user or not user.is_authenticated:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if (
            not self._is_admin(user)
            and property_obj.owner_id != user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only request recheck "
                        "for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if property_obj.report_flag_status not in [
            "flagged",
            "hidden",
        ]:
            return Response(
                {
                    "detail": (
                        "This property is not "
                        "currently flagged."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj.report_flag_status = "reviewing"

        property_obj.save(
            update_fields=["report_flag_status"]
        )

        from notifications.models import Notification

        admins = User.objects.filter(
            role="admin",
            is_active=True,
        )

        for admin in admins:
            Notification.objects.create(
                recipient=admin,
                message=(
                    "Owner requested recheck for property "
                    f'"{property_obj.property_name}". '
                    f"Current report count: "
                    f"{property_obj.reported_count}. "
                    "Main reasons: "
                    # Use a fallback when there is no report reason summary.
                    f"{property_obj.report_flag_reason_summary or 'Not available'}."
                                    ),
                notification_type="property_submitted",
                related_property_id=property_obj.id,
            )

        try:
            log_property_event(
                message=(
                    "Property recheck requested: "
                    f"{property_obj.property_name}"
                ),
                status="info",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id}, "
                    f"Report status: "
                    f"{property_obj.report_flag_status}, "
                    f"Reported count: "
                    f"{property_obj.reported_count}"
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return Response(
            {
                "message": (
                    "Recheck request submitted successfully."
                )
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  Hostel room management                                            #
# ------------------------------------------------------------------ #


class RoomViewSet(viewsets.ModelViewSet):
    serializer_class = RoomSerializer
    permission_classes = [
        permissions.IsAuthenticated
    ]

    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or getattr(user, "role", None) == "admin"
            )
        )

    def get_queryset(self):
        user = self.request.user

        queryset = (
            Room.objects.select_related(
                "property",
                "property__owner",
            )
            .order_by("-id")
        )

        if self._is_admin(user):
            return queryset

        if getattr(user, "role", None) == "owner":
            return queryset.filter(
                property__owner=user
            )

        return queryset.none()

    def create(self, request, *args, **kwargs):
        property_id = request.data.get("property")

        if not property_id:
            return Response(
                {"detail": "Property is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            property_obj = Property.objects.get(
                id=property_id
            )
        except Property.DoesNotExist:
            return Response(
                {"detail": "Property not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if property_obj.category != "hostel":
            return Response(
                {
                    "detail": (
                        "Rooms can only be created "
                        "for hostel properties."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            not self._is_admin(request.user)
            and property_obj.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only add rooms "
                        "to your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            data=request.data,
            context={
                "request": request,
                "property": property_obj,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        room = serializer.save()

        return Response(
            self.get_serializer(room).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        room = self.get_object()

        if (
            not self._is_admin(request.user)
            and room.property.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only update rooms "
                        "for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().update(
            request,
            *args,
            **kwargs,
        )

    def partial_update(
        self,
        request,
        *args,
        **kwargs,
    ):
        room = self.get_object()

        if (
            not self._is_admin(request.user)
            and room.property.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only update rooms "
                        "for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().partial_update(
            request,
            *args,
            **kwargs,
        )

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()

        if (
            not self._is_admin(request.user)
            and room.property.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only delete rooms "
                        "for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


# ------------------------------------------------------------------ #
#  Apartment unit management                                        #
# ------------------------------------------------------------------ #


class ApartmentUnitViewSet(viewsets.ModelViewSet):
    """
    Allows owners to manage separately rentable units belonging
    to their own multi-unit apartment property.

    Admins retain the same broad management ability already used
    by the hostel room API.
    """

    serializer_class = ApartmentUnitSerializer
    permission_classes = [
        permissions.IsAuthenticated
    ]

    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or getattr(user, "role", None) == "admin"
            )
        )

    # Owners see only units belonging to their own properties,
    # while administrators may manage all apartment units.
    def get_queryset(self):
        user = self.request.user

        queryset = (
            ApartmentUnit.objects.select_related(
                "property",
                "property__owner",
            )
            .order_by("-id")
        )

        if self._is_admin(user):
            return queryset

        if getattr(user, "role", None) == "owner":
            return queryset.filter(
                property__owner=user
            )

        return queryset.none()

    # Creates a unit only under a valid multi-unit apartment.
    def create(self, request, *args, **kwargs):
        property_id = request.data.get("property")

        if not property_id:
            return Response(
                {"detail": "Property is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            property_obj = Property.objects.get(
                id=property_id
            )
        except Property.DoesNotExist:
            return Response(
                {"detail": "Property not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Apartment units cannot be attached to houses or hostels.
        if property_obj.category != "apartment":
            return Response(
                {
                    "detail": (
                        "Apartment units can only be created "
                        "for apartment properties."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # A single-apartment listing is already the rentable unit,
        # so additional child units are not allowed.
        if (
            property_obj.apartment_listing_type
            != "multi_unit"
        ):
            return Response(
                {
                    "detail": (
                        "Units can only be created for "
                        "multi-unit apartment properties."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normal owners may manage only their own apartment property.
        if (
            not self._is_admin(request.user)
            and property_obj.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only add apartment units "
                        "to your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            data=request.data,
            context={
                "request": request,
                "property": property_obj,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        apartment_unit = serializer.save()

        # ApartmentUnit.save() already recalculates parent
        # property availability.
        property_obj.refresh_from_db(
            fields=["is_available"]
        )

        try:
            log_property_event(
                message=(
                    "Apartment unit created: "
                    f"{property_obj.property_name} - "
                    f"Unit {apartment_unit.unit_number}"
                ),
                status="success",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id}, "
                    f"Unit ID: {apartment_unit.id}, "
                    f"Bedrooms: {apartment_unit.bedrooms}, "
                    f"Bathrooms: {apartment_unit.bathrooms}, "
                    f"Price: {apartment_unit.price}"
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return Response(
            self.get_serializer(
                apartment_unit
            ).data,
            status=status.HTTP_201_CREATED,
        )

    # Protects units belonging to another owner's property.
    def update(self, request, *args, **kwargs):
        apartment_unit = self.get_object()

        if (
            not self._is_admin(request.user)
            and apartment_unit.property.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only update apartment units "
                        "for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        response = super().update(
            request,
            *args,
            **kwargs,
        )

        try:
            log_property_event(
                message=(
                    "Apartment unit updated: "
                    f"{apartment_unit.property.property_name} "
                    f"- Unit {apartment_unit.unit_number}"
                ),
                status="info",
                user=request.user,
                detail=(
                    f"Property ID: "
                    f"{apartment_unit.property_id}, "
                    f"Unit ID: {apartment_unit.id}"
                ),
                endpoint=request.path,
                property_id=apartment_unit.property_id,
            )
        except Exception:
            pass

        return response

    # Supports normal PATCH requests while preserving ownership rules.
    def partial_update(
        self,
        request,
        *args,
        **kwargs,
    ):
        apartment_unit = self.get_object()

        if (
            not self._is_admin(request.user)
            and apartment_unit.property.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only update apartment units "
                        "for your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        response = super().partial_update(
            request,
            *args,
            **kwargs,
        )

        try:
            log_property_event(
                message=(
                    "Apartment unit updated: "
                    f"{apartment_unit.property.property_name} "
                    f"- Unit {apartment_unit.unit_number}"
                ),
                status="info",
                user=request.user,
                detail=(
                    f"Property ID: "
                    f"{apartment_unit.property_id}, "
                    f"Unit ID: {apartment_unit.id}"
                ),
                endpoint=request.path,
                property_id=apartment_unit.property_id,
            )
        except Exception:
            pass

        return response

    # Deleting one unit recalculates whether the parent apartment
    # still has any rentable units remaining.
    def destroy(self, request, *args, **kwargs):
        apartment_unit = self.get_object()

        if (
            not self._is_admin(request.user)
            and apartment_unit.property.owner_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only delete apartment units "
                        "from your own property."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = apartment_unit.property
        unit_number = apartment_unit.unit_number
        unit_id = apartment_unit.id

        response = super().destroy(
            request,
            *args,
            **kwargs,
        )

        try:
            log_property_event(
                message=(
                    "Apartment unit deleted: "
                    f"{property_obj.property_name} "
                    f"- Unit {unit_number}"
                ),
                status="info",
                user=request.user,
                detail=(
                    f"Property ID: {property_obj.id}, "
                    f"Deleted unit ID: {unit_id}"
                ),
                endpoint=request.path,
                property_id=property_obj.id,
            )
        except Exception:
            pass

        return response


# ------------------------------------------------------------------ #
#  Landlord helpers                                                  #
# ------------------------------------------------------------------ #


def _get_registered_landlord_or_404(id):
    try:
        return User.objects.get(
            id=id,
            role="owner",
        )
    except User.DoesNotExist:
        return None


def _get_external_landlord_or_404(id):
    try:
        return ExternalLandlord.objects.get(id=id)
    except ExternalLandlord.DoesNotExist:
        return None


# ------------------------------------------------------------------ #
#  Favorite endpoints                                                #
# ------------------------------------------------------------------ #


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_favorites(request):
    favorites = (
        Favorite.objects.filter(
            user=request.user
        )
        .select_related(
            "property",
            "property__owner",
            "property__external_landlord",
            "property__approved_by",
        )
        .prefetch_related(
            "property__images",
            "property__rooms",
            "property__apartment_units",
        )
        .order_by("-created_at")
    )

    return Response(
        FavoriteSerializer(
            favorites,
            many=True,
            context={"request": request},
        ).data,
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def add_favorite(request):
    serializer = FavoriteSerializer(
        data=request.data,
        context={"request": request},
    )

    serializer.is_valid(
        raise_exception=True
    )

    favorite = serializer.save()

    return Response(
        FavoriteSerializer(
            favorite,
            context={"request": request},
        ).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def remove_favorite(request, property_id):
    deleted_count, _ = Favorite.objects.filter(
        user=request.user,
        property_id=property_id,
    ).delete()

    if deleted_count == 0:
        return Response(
            {"detail": "Favorite not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {"detail": "Removed from favorites."},
        status=status.HTTP_200_OK,
    )


# ------------------------------------------------------------------ #
#  Registered landlord endpoints                                     #
# ------------------------------------------------------------------ #


@api_view(["GET"])
@permission_classes([AllowAny])
def registered_landlord_detail(request, id):
    user = _get_registered_landlord_or_404(id)

    if not user:
        return Response(
            {
                "detail": (
                    "Registered landlord not found."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        RegisteredLandlordSerializer(
            user,
            context={"request": request},
        ).data,
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def registered_landlord_properties(request, id):
    user = _get_registered_landlord_or_404(id)

    if not user:
        return Response(
            {
                "detail": (
                    "Registered landlord not found."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    properties = (
        Property.objects.filter(
            owner=user,
            approval_status="approved",
            report_flag_status="active",
        )
        .select_related(
            "owner",
            "external_landlord",
            "approved_by",
        )
        .prefetch_related(
            "images",
            "rooms",
            "apartment_units",
        )
        .order_by("-id")
    )

    paginator = PropertyPagination()

    page = paginator.paginate_queryset(
        properties,
        request,
    )

    return paginator.get_paginated_response(
        PropertySerializer(
            page,
            many=True,
            context={"request": request},
        ).data
    )


# ------------------------------------------------------------------ #
#  External landlord endpoints                                       #
# ------------------------------------------------------------------ #


@api_view(["GET"])
@permission_classes([AllowAny])
def external_landlord_detail(request, id):
    landlord = _get_external_landlord_or_404(id)

    if not landlord:
        return Response(
            {
                "detail": (
                    "External landlord not found."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        ExternalLandlordSerializer(
            landlord,
            context={"request": request},
        ).data,
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def external_landlord_properties(request, id):
    landlord = _get_external_landlord_or_404(id)

    if not landlord:
        return Response(
            {
                "detail": (
                    "External landlord not found."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    properties = (
        Property.objects.filter(
            external_landlord=landlord,
            approval_status="approved",
        )
        .select_related(
            "owner",
            "external_landlord",
            "approved_by",
        )
        .prefetch_related(
            "images",
            "rooms",
            "apartment_units",
        )
        .order_by("-id")
    )

    paginator = PropertyPagination()

    page = paginator.paginate_queryset(
        properties,
        request,
    )

    return paginator.get_paginated_response(
        PropertySerializer(
            page,
            many=True,
            context={"request": request},
        ).data
    )