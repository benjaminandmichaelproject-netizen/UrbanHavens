from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Booking
from .serializers import BookingSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        if self.action == "my_owner_bookings":
            return Booking.objects.filter(owner=user).order_by("-id")

        if self.action == "my_tenant_bookings":
            return Booking.objects.filter(tenant=user).order_by("-id")

        if self.action == "list":
            if user.is_superuser or role == "admin":
                return Booking.objects.all().order_by("-id")
            return Booking.objects.filter(tenant=user).order_by("-id")

        if self.action in ["retrieve", "update", "partial_update", "destroy"]:
            if user.is_superuser or role == "admin":
                return Booking.objects.all().order_by("-id")

            return Booking.objects.filter(tenant=user).order_by("-id") | Booking.objects.filter(owner=user).order_by("-id")

        return Booking.objects.none()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"])
    def my_owner_bookings(self, request):
        bookings = Booking.objects.filter(owner=request.user).order_by("-id")
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_tenant_bookings(self, request):
        bookings = Booking.objects.filter(tenant=request.user).order_by("-id")
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)