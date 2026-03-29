from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ExternalLandlord, Favorite, Property, Room
from .pagination import PropertyPagination
from .serializers import (
    ExternalLandlordSerializer,
    FavoriteSerializer,
    PropertySerializer,
    RegisteredLandlordSerializer,
    RoomSerializer,
)
User = get_user_model()


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or getattr(user, "role", None) == "admin":
            return True

        return obj.owner_id == user.id


class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    pagination_class = PropertyPagination
    queryset = Property.objects.none()

    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or getattr(user, "role", None) == "admin")
        )

    def _base_queryset(self):
        return (
            Property.objects.select_related("owner", "external_landlord", "approved_by")
            .prefetch_related("images", "rooms")
            .order_by("-id")
        )

    def get_queryset(self):
        queryset = self._base_queryset()
        user = self.request.user if hasattr(self.request, "user") else None

        if self.action in ["list", "featured"]:
            queryset = queryset.filter(approval_status="approved")

            category = self.request.query_params.get("category")
            if category:
                queryset = queryset.filter(category=category)

            is_available = self.request.query_params.get("is_available")
            if is_available is not None:
                queryset = queryset.filter(is_available=is_available.lower() == "true")

            return queryset

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

        if user and user.is_authenticated and getattr(user, "role", None) == "owner":
            return queryset.filter(owner=user)

        return queryset.none()

    def get_permissions(self):
        if self.action in ["list", "retrieve", "featured"]:
            return [AllowAny()]

        if self.action in ["create", "my_properties"]:
            return [permissions.IsAuthenticated()]

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
        serializer.save()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        if instance.approval_status != "approved":
            if not user or not user.is_authenticated:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

            if self._is_admin(user):
                return Response(self.get_serializer(instance).data)

            if getattr(user, "role", None) == "owner" and instance.owner_id == user.id:
                return Response(self.get_serializer(instance).data)

            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=["get"], url_path="my-properties")
    def my_properties(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=["get"], url_path="admin-list")
    def admin_list(self, request):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can view all properties."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=["get"], url_path="featured", permission_classes=[AllowAny])
    def featured(self, request):
        queryset = (
            Property.objects.filter(approval_status="approved", is_featured=True)
            .select_related("owner", "external_landlord", "approved_by")
            .prefetch_related("images", "rooms")
            .order_by("-updated_at")[:6]
        )
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can approve properties."},
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()
        property_obj.approval_status = "approved"
        property_obj.approved_by = request.user
        property_obj.approved_at = timezone.now()

        if property_obj.category == "hostel":
            property_obj.sync_availability()
            property_obj.refresh_from_db()
            property_obj.approved_by = request.user
            property_obj.approved_at = timezone.now()
            property_obj.approval_status = "approved"
            property_obj.save(update_fields=["approval_status", "approved_by", "approved_at"])
        else:
            property_obj.is_available = True
            property_obj.save(
                update_fields=["approval_status", "is_available", "approved_by", "approved_at"]
            )

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can reject properties."},
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

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="feature")
    def feature(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can feature properties."},
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()
        if property_obj.approval_status != "approved":
            return Response(
                {"detail": "Only approved properties can be featured."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj.is_featured = True
        property_obj.save(update_fields=["is_featured"])

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="unfeature")
    def unfeature(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can unfeature properties."},
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()
        property_obj.is_featured = False
        property_obj.save(update_fields=["is_featured"])

        return Response(
            self.get_serializer(property_obj).data,
            status=status.HTTP_200_OK,
        )
        
    @action(detail=True, methods=["post"], url_path="request-recheck")
    def request_recheck(self, request, pk=None):
        property_obj = self.get_object()
        user = request.user

        if not user or not user.is_authenticated:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not self._is_admin(user) and property_obj.owner_id != user.id:
            return Response(
                {"detail": "You can only request recheck for your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if property_obj.report_flag_status not in ["flagged", "hidden"]:
            return Response(
                {"detail": "This property is not currently flagged."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj.report_flag_status = "reviewing"
        property_obj.save(update_fields=["report_flag_status"])

        from notifications.models import Notification

        admins = User.objects.filter(role="admin", is_active=True)

        for admin in admins:
            Notification.objects.create(
                recipient=admin,
                message=(
                    f'Owner requested recheck for property "{property_obj.property_name}". '
                    f"Current report count: {property_obj.reported_count}. "
                    f"Main reasons: {property_obj.report_flag_reason_summary or 'Not available'}."
                ),
                notification_type="property_submitted",
                related_property_id=property_obj.id,
            )

        return Response(
            {"message": "Recheck request submitted successfully."},
            status=status.HTTP_200_OK,
        )

class RoomViewSet(viewsets.ModelViewSet):
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or getattr(user, "role", None) == "admin")
        )

    def get_queryset(self):
        user = self.request.user
        queryset = Room.objects.select_related("property", "property__owner").order_by("-id")

        if self._is_admin(user):
            return queryset

        if getattr(user, "role", None) == "owner":
            return queryset.filter(property__owner=user)

        return queryset.none()

    def create(self, request, *args, **kwargs):
        property_id = request.data.get("property")
        if not property_id:
            return Response(
                {"detail": "Property is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            property_obj = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            return Response(
                {"detail": "Property not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if property_obj.category != "hostel":
            return Response(
                {"detail": "Rooms can only be created for hostel properties."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not self._is_admin(request.user) and property_obj.owner_id != request.user.id:
            return Response(
                {"detail": "You can only add rooms to your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data, context={"property": property_obj})
        serializer.is_valid(raise_exception=True)
        room = serializer.save()

        return Response(
            self.get_serializer(room).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        room = self.get_object()
        if not self._is_admin(request.user) and room.property.owner_id != request.user.id:
            return Response(
                {"detail": "You can only update rooms for your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        room = self.get_object()
        if not self._is_admin(request.user) and room.property.owner_id != request.user.id:
            return Response(
                {"detail": "You can only update rooms for your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()
        if not self._is_admin(request.user) and room.property.owner_id != request.user.id:
            return Response(
                {"detail": "You can only delete rooms for your own property."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)
def _get_registered_landlord_or_404(id):
    try:
        return User.objects.get(id=id, role="owner")
    except User.DoesNotExist:
        return None


def _get_external_landlord_or_404(id):
    try:
        return ExternalLandlord.objects.get(id=id)
    except ExternalLandlord.DoesNotExist:
        return None


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_favorites(request):
    favorites = (
        Favorite.objects.filter(user=request.user)
        .select_related(
            "property",
            "property__owner",
            "property__external_landlord",
            "property__approved_by",
        )
        .prefetch_related("property__images", "property__rooms")
        .order_by("-created_at")
    )
    return Response(
        FavoriteSerializer(favorites, many=True, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def add_favorite(request):
    serializer = FavoriteSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    favorite = serializer.save()
    return Response(
        FavoriteSerializer(favorite, context={"request": request}).data,
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


@api_view(["GET"])
@permission_classes([AllowAny])
def registered_landlord_detail(request, id):
    user = _get_registered_landlord_or_404(id)
    if not user:
        return Response(
            {"detail": "Registered landlord not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        RegisteredLandlordSerializer(user, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def registered_landlord_properties(request, id):
    user = _get_registered_landlord_or_404(id)
    if not user:
        return Response(
            {"detail": "Registered landlord not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    properties = (
        Property.objects.filter(owner=user, approval_status="approved")
        .select_related("owner", "external_landlord", "approved_by")
        .prefetch_related("images", "rooms")
        .order_by("-id")
    )

    paginator = PropertyPagination()
    page = paginator.paginate_queryset(properties, request)
    return paginator.get_paginated_response(
        PropertySerializer(page, many=True, context={"request": request}).data
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def external_landlord_detail(request, id):
    landlord = _get_external_landlord_or_404(id)
    if not landlord:
        return Response(
            {"detail": "External landlord not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        ExternalLandlordSerializer(landlord, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def external_landlord_properties(request, id):
    landlord = _get_external_landlord_or_404(id)
    if not landlord:
        return Response(
            {"detail": "External landlord not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    properties = (
        Property.objects.filter(external_landlord=landlord, approval_status="approved")
        .select_related("owner", "external_landlord", "approved_by")
        .prefetch_related("images", "rooms")
        .order_by("-id")
    )

    paginator = PropertyPagination()
    page = paginator.paginate_queryset(properties, request)
    return paginator.get_paginated_response(
        PropertySerializer(page, many=True, context={"request": request}).data
    )