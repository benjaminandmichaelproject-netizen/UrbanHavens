from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Property
from .serializers import PropertySerializer

User = get_user_model()


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_superuser or obj.owner == request.user


class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer

    def get_queryset(self):
        if self.action == "list":
            return Property.objects.all().order_by("-id")[:6]
        elif self.action == "my_properties":
            return Property.objects.filter(owner=self.request.user).order_by("-id")
        return Property.objects.all().order_by("-id")

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        elif self.action in ["create", "my_properties"]:
            return [permissions.IsAuthenticated()]
        elif self.action in ["update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @action(detail=False, methods=["get"])
    def my_properties(self, request):
        properties = self.get_queryset()
        serializer = self.get_serializer(properties, many=True)
        return Response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def landlord_detail(request, id):
    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"detail": "Landlord not found"}, status=404)

    profile = getattr(user, "landlord_profile", None)

    return Response({
        "id": user.id,
        "name": user.username,
        "phone": getattr(user, "phone", ""),
        "title": "Property Owner",
        "photo": None,
        "coverPhoto": None,
        "is_verified": profile.is_verified if profile else False,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def landlord_properties(request, id):
    properties = Property.objects.filter(owner_id=id).order_by("-id")
    serializer = PropertySerializer(
        properties,
        many=True,
        context={"request": request}
    )
    return Response(serializer.data)