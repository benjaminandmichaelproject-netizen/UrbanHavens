from django.urls import path
from .views import (
    school_search,
    region_list,
    school_manage_list_create,
    school_manage_detail,
)

urlpatterns = [
    path("", school_search, name="school-search"),
    path("regions/", region_list, name="school-regions"),
    path("manage/", school_manage_list_create, name="school-manage-list-create"),
    path("manage/<int:pk>/", school_manage_detail, name="school-manage-detail"),
]