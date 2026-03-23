from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("properties.urls")),
    path("api/", include("users.urls")),
    path("api/", include("bookings.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("leases.urls")),
    path("api/", include("schools.urls")),       
     path("api/assistant/", include("assistant.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)