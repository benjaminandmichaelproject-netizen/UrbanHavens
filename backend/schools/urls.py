from django.urls import path
from .views import school_search, region_list

urlpatterns = [
    path("schools/",         school_search, name="school-search"),
    path("schools/regions/", region_list,   name="school-regions"),
]