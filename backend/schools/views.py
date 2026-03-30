from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from .models import School
from .serializers import SchoolSerializer


# Map region DB values to display labels and default map centres
# Coordinates are approximate regional center points for map defaults.

REGION_META = {
    "ahafo": {
        "label": "Ahafo",
        "center_lat": 7.2420,
        "center_lng": -2.3390,
    },
    "ashanti": {
        "label": "Ashanti",
        "center_lat": 6.6885,
        "center_lng": -1.6244,
    },
    "bono": {
        "label": "Bono",
        "center_lat": 7.3399,
        "center_lng": -2.3268,
    },
    "bono_east": {
        "label": "Bono East",
        "center_lat": 7.8930,
        "center_lng": -1.0910,
    },
    "central": {
        "label": "Central",
        "center_lat": 5.5600,
        "center_lng": -1.0580,
    },
    "eastern": {
        "label": "Eastern",
        "center_lat": 6.3870,
        "center_lng": -0.3770,
    },
    "greater_accra": {
        "label": "Greater Accra",
        "center_lat": 5.6037,
        "center_lng": -0.1870,
    },
    "north_east": {
        "label": "North East",
        "center_lat": 10.5160,
        "center_lng": -0.3660,
    },
    "northern": {
        "label": "Northern",
        "center_lat": 9.4075,
        "center_lng": -0.8533,
    },
    "oti": {
        "label": "Oti",
        "center_lat": 8.1330,
        "center_lng": 0.3200,
    },
    "savannah": {
        "label": "Savannah",
        "center_lat": 9.0830,
        "center_lng": -1.8170,
    },
    "upper_east": {
        "label": "Upper East",
        "center_lat": 10.7856,
        "center_lng": -0.8514,
    },
    "upper_west": {
        "label": "Upper West",
        "center_lat": 10.3660,
        "center_lng": -2.5000,
    },
    "volta": {
        "label": "Volta",
        "center_lat": 6.6000,
        "center_lng": 0.4700,
    },
    "western": {
        "label": "Western",
        "center_lat": 4.8960,
        "center_lng": -1.7740,
    },
    "western_north": {
        "label": "Western North",
        "center_lat": 6.3000,
        "center_lng": -2.8000,
    },
}

@api_view(["GET"])
@permission_classes([AllowAny])
def school_search(request):
    """
    GET /api/schools/?q=knust
    Returns up to 10 matching active schools for autocomplete.
    """
    query = request.query_params.get("q", "").strip()

    if not query or len(query) < 2:
        return Response([])

    schools = (
        School.objects.filter(
            name__icontains=query,
            is_active=True,
        )
        .values("id", "name", "city", "region", "is_active")
        [:10]
    )

    return Response(list(schools))


@api_view(["GET"])
@permission_classes([AllowAny])
def region_list(request):
    """
    GET /api/schools/regions/
    Returns distinct regions that have at least one active school,
    with display label and default map centre coordinates.
    """
    regions = (
        School.objects.filter(is_active=True)
        .values_list("region", flat=True)
        .distinct()
        .order_by("region")
    )

    result = []
    for region_value in regions:
        meta = REGION_META.get(region_value, {})
        result.append(
            {
                "value": region_value,
                "label": meta.get("label", region_value.replace("_", " ").title()),
                "center_lat": meta.get("center_lat", 5.6037),
                "center_lng": meta.get("center_lng", -0.1870),
            }
        )

    return Response(result)


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def school_manage_list_create(request):
    """
    GET  /api/schools/manage/
    POST /api/schools/manage/
    Admin-only school list and create endpoint.
    """
    if request.method == "GET":
        schools = School.objects.all().order_by("name")
        serializer = SchoolSerializer(schools, many=True)
        return Response(serializer.data)

    serializer = SchoolSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH", "DELETE", "GET"])
@permission_classes([IsAdminUser])
def school_manage_detail(request, pk):
    """
    GET    /api/schools/manage/<id>/
    PATCH  /api/schools/manage/<id>/
    DELETE /api/schools/manage/<id>/
    Admin-only retrieve/update/delete endpoint.
    """
    school = get_object_or_404(School, pk=pk)

    if request.method == "GET":
        serializer = SchoolSerializer(school)
        return Response(serializer.data)

    if request.method == "PATCH":
        serializer = SchoolSerializer(school, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    school.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)