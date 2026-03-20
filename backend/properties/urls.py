from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PropertyViewSet,
    external_landlord_detail,
    external_landlord_properties,
    registered_landlord_detail,
    registered_landlord_properties,
)

router = DefaultRouter()
router.register(r"properties", PropertyViewSet, basename="property")

urlpatterns = [
    path("", include(router.urls)),

    path(
        "registered-landlords/<int:id>/",
        registered_landlord_detail,
        name="registered-landlord-detail",
    ),
    path(
        "registered-landlords/<int:id>/properties/",
        registered_landlord_properties,
        name="registered-landlord-properties",
    ),

    path(
        "external-landlords/<int:id>/",
        external_landlord_detail,
        name="external-landlord-detail",
    ),
    path(
        "external-landlords/<int:id>/properties/",
        external_landlord_properties,
        name="external-landlord-properties",
    ),
]