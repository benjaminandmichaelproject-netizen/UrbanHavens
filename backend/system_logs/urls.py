# system_logs/urls.py
from rest_framework.routers import DefaultRouter
from .views import SystemLogViewSet

router = DefaultRouter()
router.register(r"system-logs", SystemLogViewSet, basename="system-logs")

urlpatterns = router.urls