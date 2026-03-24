import math
from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import Property
from .serializers import PropertySerializer


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2 +
        math.cos(math.radians(lat1)) *
        math.cos(math.radians(lat2)) *
        math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@method_decorator(csrf_exempt, name="dispatch")
class NearbyPropertiesView(View):

    def get(self, request):
        try:
            user_lat = float(request.GET.get("lat"))
            user_lng = float(request.GET.get("lng"))
        except (TypeError, ValueError):
            return JsonResponse(
                {"error": "lat and lng are required as valid numbers"},
                status=400,
            )

        try:
            radius = min(float(request.GET.get("radius", 20)), 100)
            limit  = min(int(request.GET.get("limit", 12)), 30)
        except (TypeError, ValueError):
            radius, limit = 20, 12

        qs = Property.objects.filter(
            is_available=True,
            approval_status="approved",
            lat__isnull=False,
            lng__isnull=False,
        ).select_related("owner")

        results = []
        for prop in qs:
            try:
                dist = haversine_km(
                    user_lat, user_lng,
                    float(prop.lat), float(prop.lng)
                )
            except (TypeError, ValueError):
                continue

            if dist <= radius:
                results.append((dist, prop))

        results.sort(key=lambda x: x[0])
        results = results[:limit]

        output = []
        for dist, prop in results:
            serializer = PropertySerializer(prop, context={"request": request})
            data = serializer.data
            data["distance_km"] = round(dist, 2)
            data["distance_label"] = (
                f"{round(dist * 1000)}m away" if dist < 1
                else f"{round(dist, 1)} km away"
            )
            output.append(data)

        return JsonResponse({
            "count":      len(output),
            "user_lat":   user_lat,
            "user_lng":   user_lng,
            "radius_km":  radius,
            "properties": output,
        })