from rest_framework.routers import DefaultRouter
from .views import TenantLeaseViewSet

router = DefaultRouter()
router.register(r"leases", TenantLeaseViewSet, basename="lease")

urlpatterns = router.urls