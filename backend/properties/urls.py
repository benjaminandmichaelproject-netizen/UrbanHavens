from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PropertyViewSet, landlord_detail, landlord_properties

router = DefaultRouter()
router.register(r"properties", PropertyViewSet, basename="property")

urlpatterns = [
    path("", include(router.urls)),
    path("landlords/<int:id>/", landlord_detail, name="landlord-detail"),
    path("landlords/<int:id>/properties/", landlord_properties, name="landlord-properties"),
]