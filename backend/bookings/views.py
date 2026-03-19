from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Booking
from .serializers import BookingSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if self.action == "my_owner_bookings":
            return Booking.objects.filter(owner=user).order_by("-id")

        if self.action == "my_tenant_bookings":
            return Booking.objects.filter(tenant=user).order_by("-id")

        return Booking.objects.all().order_by("-id")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"])
    def my_owner_bookings(self, request):
        bookings = self.get_queryset()
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_tenant_bookings(self, request):
        bookings = self.get_queryset()
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)