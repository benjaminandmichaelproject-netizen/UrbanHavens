from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ExternalLandlord, Favorite, Property
from .pagination import PropertyPagination
from .serializers import (
    ExternalLandlordSerializer,
    FavoriteSerializer,
    PropertySerializer,
    RegisteredLandlordSerializer,
)
User = get_user_model()


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Allow safe methods for everyone.
    Allow write actions for:
    - admins
    - superusers
    - the registered owner of the property
    """

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

    def _is_admin(self, user):
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or getattr(user, "role", None) == "admin")
        )

    def get_queryset(self):
        queryset = (
            Property.objects.select_related("owner", "external_landlord", "approved_by")
            .prefetch_related("images")
            .order_by("-id")
        )

        user = self.request.user if hasattr(self.request, "user") else None

        # Public-facing lists only show approved properties
        if self.action in ["list", "featured"]:
            return queryset.filter(approval_status="approved")

        # Let retrieve load the object first.
        # Actual access control is handled inside retrieve()
        if self.action == "retrieve":
            return queryset

        # Owner dashboard view
        if self.action == "my_properties":
            if not user or not user.is_authenticated:
                return queryset.none()

            if getattr(user, "role", None) == "owner":
                return queryset.filter(owner=user)

            if self._is_admin(user):
                return queryset

            return queryset.none()

        # Admin-only list of all properties
        if self.action == "admin_list":
            if self._is_admin(user):
                return queryset
            return queryset.none()

        # Admins can access everything for moderation actions
        if self._is_admin(user):
            return queryset

        # Owners can update/delete only their own properties
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

        # Public can only retrieve approved properties
        if instance.approval_status != "approved":
            if not user or not user.is_authenticated:
                return Response(
                    {"detail": "Not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if self._is_admin(user):
                serializer = self.get_serializer(instance)
                return Response(serializer.data)

            if getattr(user, "role", None) == "owner" and instance.owner_id == user.id:
                serializer = self.get_serializer(instance)
                return Response(serializer.data)

            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-properties")
    def my_properties(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="featured", permission_classes=[AllowAny])
    def featured(self, request):
        queryset = (
            Property.objects.filter(approval_status="approved", is_featured=True)
            .select_related("owner", "external_landlord", "approved_by")
            .prefetch_related("images")
            .order_by("-updated_at")[:6]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

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
        property_obj.save()

        serializer = self.get_serializer(property_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can reject properties."},
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()
        property_obj.approval_status = "rejected"
        property_obj.is_featured = False
        property_obj.approved_by = None
        property_obj.approved_at = None
        property_obj.save()

        serializer = self.get_serializer(property_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
        property_obj.save()

        serializer = self.get_serializer(property_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="unfeature")
    def unfeature(self, request, pk=None):
        if not self._is_admin(request.user):
            return Response(
                {"detail": "Only admins can unfeature properties."},
                status=status.HTTP_403_FORBIDDEN,
            )

        property_obj = self.get_object()
        property_obj.is_featured = False
        property_obj.save()

        serializer = self.get_serializer(property_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)


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
        .select_related("property", "property__owner", "property__external_landlord", "property__approved_by")
        .prefetch_related("property__images")
        .order_by("-created_at")
    )

    serializer = FavoriteSerializer(
        favorites,
        many=True,
        context={"request": request},
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def add_favorite(request):
    serializer = FavoriteSerializer(
        data=request.data,
        context={"request": request},
    )
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

    serializer = RegisteredLandlordSerializer(user, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


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
        .prefetch_related("images")
        .order_by("-id")
    )

    paginator = PropertyPagination()
    page = paginator.paginate_queryset(properties, request)
    serializer = PropertySerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def external_landlord_detail(request, id):
    landlord = _get_external_landlord_or_404(id)
    if not landlord:
        return Response(
            {"detail": "External landlord not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = ExternalLandlordSerializer(
        landlord,
        context={"request": request},
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


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
        .prefetch_related("images")
        .order_by("-id")
    )

    paginator = PropertyPagination()
    page = paginator.paginate_queryset(properties, request)
    serializer = PropertySerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)
