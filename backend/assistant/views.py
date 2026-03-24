import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.db.models import Q

from .models import ChatSession, ChatMessage


def _get_user_from_request(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1]

    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model

        User = get_user_model()
        decoded = AccessToken(token)
        return User.objects.get(id=decoded["user_id"])
    except Exception:
        return None


def _get_system_prompt():
    from .prompt import build_system_prompt
    return build_system_prompt()


def _get_gemini_client():
    from google import genai
    from django.conf import settings
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _build_queryset(filters: dict):
    from properties.models import Property

    qs = Property.objects.filter(is_available=True).select_related("owner")

    if loc := filters.get("location"):
        qs = qs.filter(
            Q(city__icontains=loc) |
            Q(region__icontains=loc) |
            Q(school__icontains=loc) |
            Q(property_name__icontains=loc) |
            Q(description__icontains=loc)
        )

    if bedrooms := filters.get("bedrooms"):
        try:
            qs = qs.filter(bedrooms=int(bedrooms))
        except (ValueError, TypeError):
            pass

    if max_price := filters.get("max_price"):
        try:
            qs = qs.filter(price__lte=float(max_price))
        except (ValueError, TypeError):
            pass

    if min_price := filters.get("min_price"):
        try:
            qs = qs.filter(price__gte=float(min_price))
        except (ValueError, TypeError):
            pass

    if category := filters.get("category"):
        qs = qs.filter(category__iexact=category)

    if ptype := filters.get("property_type"):
        qs = qs.filter(property_type__icontains=ptype)

    return qs[:10]


def _find_property_matches(filters: dict):
    """
    Returns:
    queryset, match_type
    match_type = exact | relaxed | fallback | none
    """

    exact_qs = _build_queryset(filters)
    if exact_qs.exists():
        return exact_qs, "exact"

    # Relax price constraints first
    relaxed_filters = dict(filters)
    relaxed_filters.pop("max_price", None)
    relaxed_filters.pop("min_price", None)

    relaxed_qs = _build_queryset(relaxed_filters)
    if relaxed_qs.exists():
        return relaxed_qs, "relaxed"

    # Relax bedrooms and property type too, but keep location/category if possible
    fallback_filters = {
        "location": filters.get("location"),
        "category": filters.get("category"),
    }

    fallback_qs = _build_queryset(fallback_filters)
    if fallback_qs.exists():
        return fallback_qs, "fallback"

    # Final attempt: category only
    if filters.get("category"):
        category_only_qs = _build_queryset({
            "category": filters.get("category")
        })
        if category_only_qs.exists():
            return category_only_qs, "fallback"

    return exact_qs, "none"


def _serialize_properties(queryset):
    try:
        from properties.serializers import PropertyAssistantSerializer
        return list(PropertyAssistantSerializer(queryset, many=True).data)
    except ImportError:
        results = []
        for p in queryset:
            results.append({
                "id": p.id,
                "property_name": p.property_name,
                "category": getattr(p, "category", ""),
                "property_type": getattr(p, "property_type", ""),
                "bedrooms": getattr(p, "bedrooms", None),
                "bathrooms": getattr(p, "bathrooms", None),
                "price": str(p.price),
                "city": getattr(p, "city", ""),
                "region": getattr(p, "region", ""),
                "school": getattr(p, "school", ""),
                "is_available": getattr(p, "is_available", True),
                "thumbnail": None,
                "owner_name": getattr(p, "owner_name", None),
                "owner_phone": getattr(p, "owner_phone", None),
                "owner_email": getattr(p, "owner_email", None),
            })
        return results


def _extract_action(text: str):
    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        return None

    possible_json = text[start:end + 1]

    try:
        data = json.loads(possible_json)
        if isinstance(data, dict) and data.get("action"):
            return data
    except json.JSONDecodeError:
        pass

    return None


def _build_gemini_contents(system_prompt, history, user_message):
    transcript = [f"SYSTEM:\n{system_prompt}"]

    for h in history:
        role = h["role"].upper()
        transcript.append(f"{role}:\n{h['content']}")

    transcript.append(f"USER:\n{user_message}")
    transcript.append(
        "Reply exactly according to the system rules. "
        "If property search is needed, include the raw JSON action block."
    )

    return "\n\n".join(transcript)


@method_decorator(csrf_exempt, name="dispatch")
class AssistantChatView(View):
    def post(self, request):
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        user_message = body.get("message", "").strip()
        session_id = body.get("session_id")

        if not user_message:
            return JsonResponse({"error": "Message is required"}, status=400)

        user = _get_user_from_request(request)

        session = None
        if session_id:
            if user:
                session = ChatSession.objects.filter(id=session_id, user=user).first()
            else:
                session = ChatSession.objects.filter(id=session_id, user=None).first()

        if not session:
            session = ChatSession.objects.create(user=user)

        history = list(
            ChatMessage.objects
            .filter(session=session)
            .order_by("-created_at")[:10]
            .values("role", "content")
        )
        history.reverse()

        system_prompt = _get_system_prompt()
        prompt_text = _build_gemini_contents(system_prompt, history, user_message)

        try:
            client = _get_gemini_client()
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt_text,
            )
            ai_text = (response.text or "").strip()
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse(
                {"error": f"AI error: {str(e)}", "detail": traceback.format_exc()},
                status=500,
            )

        ChatMessage.objects.create(session=session, role="user", content=user_message)
        ChatMessage.objects.create(session=session, role="assistant", content=ai_text)
        session.save()

        action = _extract_action(ai_text)
        properties = []
        reply_text = ai_text

        if action and action.get("action") == "search_property":
            filters = action.get("filters", {})
            queryset, match_type = _find_property_matches(filters)
            properties = _serialize_properties(queryset)
            count = len(properties)

            if match_type == "exact":
                reply_text = (
                    f"I found {count} matching propert{'y' if count == 1 else 'ies'} for you."
                )
            elif match_type == "relaxed":
                reply_text = (
                    f"I couldn't find the exact match, but I found {count} similar propert{'y' if count == 1 else 'ies'} for you."
                )
            elif match_type == "fallback":
                reply_text = (
                    f"I couldn't find the exact property you asked for, but here are {count} alternative propert{'y' if count == 1 else 'ies'} you may like."
                )
            else:
                reply_text = (
                    "I couldn't find a matching property right now. Try another location, a higher budget, or ask me for nearby areas."
                )

        return JsonResponse({
            "session_id": str(session.id),
            "reply": reply_text,
            "action": action,
            "properties": properties,
        })


class ChatHistoryView(View):
    def get(self, request):
        user = _get_user_from_request(request)
        session_id = request.GET.get("session_id")

        if not session_id:
            return JsonResponse({"error": "session_id is required"}, status=400)

        session = None
        if user:
            session = ChatSession.objects.filter(id=session_id, user=user).first()
        else:
            session = ChatSession.objects.filter(id=session_id, user=None).first()

        if not session:
            return JsonResponse({"error": "Session not found"}, status=404)

        messages = list(
            ChatMessage.objects
            .filter(session=session)
            .order_by("created_at")
            .values("id", "role", "content", "created_at")
        )

        return JsonResponse({
            "session_id": str(session.id),
            "messages": messages,
        })