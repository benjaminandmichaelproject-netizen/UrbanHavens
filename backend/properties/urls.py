from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PropertyViewSet,
    RoomViewSet,
    add_favorite,
    external_landlord_detail,
    external_landlord_properties,
    my_favorites,
    registered_landlord_detail,
    registered_landlord_properties,
    remove_favorite,
)
from .nearby_views import NearbyPropertiesView

router = DefaultRouter()
router.register(r"properties", PropertyViewSet, basename="property")
router.register(r"rooms", RoomViewSet, basename="room")

urlpatterns = [
    path("", include(router.urls)),
    path("nearby-properties/", NearbyPropertiesView.as_view(), name="nearby-properties"),
    path("favorites/", my_favorites, name="my-favorites"),
    path("favorites/add/", add_favorite, name="add-favorite"),
    path("favorites/remove/<int:property_id>/", remove_favorite, name="remove-favorite"),
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