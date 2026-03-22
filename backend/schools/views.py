from django.shortcuts import render

# Create your views here.
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import School

# Map region DB values to display labels and default map centres
REGION_META = {
    "greater_accra": {"label": "Greater Accra", "center_lat": 5.6037,  "center_lng": -0.1870},
    "ashanti":       {"label": "Ashanti (Kumasi)", "center_lat": 6.6885, "center_lng": -1.6244},
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

    schools = School.objects.filter(
        name__icontains=query,
        is_active=True,
    ).values("id", "name", "city", "region")[:10]

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
        School.objects
        .filter(is_active=True)
        .values_list("region", flat=True)
        .distinct()
        .order_by("region")
    )

    result = []
    for region_value in regions:
        meta = REGION_META.get(region_value, {})
        result.append({
            "value":      region_value,
            "label":      meta.get("label", region_value.replace("_", " ").title()),
            "center_lat": meta.get("center_lat", 5.6037),
            "center_lng": meta.get("center_lng", -0.187),
        })

    return Response(result)