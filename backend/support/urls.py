from django.urls import path
from .views import (
    ActiveAdminsListView,
    OwnerCreateSupportSessionView,
    OwnerCurrentSupportSessionView,
    AdminPendingSupportSessionsView,
    AdminRespondSupportSessionView,
    OwnerTerminateSupportSessionView,
    AdminCurrentSupportSessionView,
)

urlpatterns = [
    path("active-admins/", ActiveAdminsListView.as_view(), name="active-admins"),
    path("owner/invite/", OwnerCreateSupportSessionView.as_view(), name="owner-invite-admin"),
    path("owner/current/", OwnerCurrentSupportSessionView.as_view(), name="owner-current-support"),
    path("owner/terminate/<int:pk>/", OwnerTerminateSupportSessionView.as_view(), name="owner-terminate-support"),
    path("admin/pending/", AdminPendingSupportSessionsView.as_view(), name="admin-pending-support"),
    path("admin/respond/<int:pk>/", AdminRespondSupportSessionView.as_view(), name="admin-respond-support"),
    path("admin/current/", AdminCurrentSupportSessionView.as_view(), name="admin-current-support"),
]