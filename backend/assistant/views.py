import json
import re

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


def _get_openai_client():
    from openai import OpenAI
    from django.conf import settings
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _build_queryset(filters: dict):
    from properties.models import Property
    qs = Property.objects.filter(is_available=True).select_related("owner")

    if loc := filters.get("location"):
        qs = qs.filter(
            Q(city__icontains=loc) |
            Q(region__icontains=loc) |
            Q(school__icontains=loc)
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


def _serialize_properties(queryset):
    try:
        from properties.serializers import PropertyAssistantSerializer
        return list(PropertyAssistantSerializer(queryset, many=True).data)
    except ImportError:
        results = []
        for p in queryset:
            results.append({
                "id":            p.id,
                "property_name": p.property_name,
                "category":      getattr(p, "category", ""),
                "property_type": getattr(p, "property_type", ""),
                "bedrooms":      getattr(p, "bedrooms", None),
                "bathrooms":     getattr(p, "bathrooms", None),
                "price":         str(p.price),
                "city":          getattr(p, "city", ""),
                "region":        getattr(p, "region", ""),
                "school":        getattr(p, "school", ""),
                "is_available":  getattr(p, "is_available", True),
                "thumbnail":     None,
                "owner_name":    getattr(p, "owner_name", None),
                "owner_phone":   getattr(p, "owner_phone", None),
                "owner_email":   getattr(p, "owner_email", None),
            })
        return results


def _extract_action(text: str):
    pattern = r'\{[^{}]*"action"\s*:[^{}]*\}'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


@method_decorator(csrf_exempt, name="dispatch")
class AssistantChatView(View):

    def post(self, request):
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        user_message = body.get("message", "").strip()
        session_id   = body.get("session_id")

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

        messages = [{"role": "system", "content": _get_system_prompt()}]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_message})

        try:
            client  = _get_openai_client()
            resp    = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3,
                max_tokens=800,
            )
            ai_text = resp.choices[0].message.content
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": f"AI error: {str(e)}", "detail": traceback.format_exc()}, status=500)

        ChatMessage.objects.create(session=session, role="user",      content=user_message)
        ChatMessage.objects.create(session=session, role="assistant", content=ai_text)
        session.save()

        action     = _extract_action(ai_text)
        properties = []
        reply_text = ai_text

        if action and action.get("action") == "search_property":
            filters    = action.get("filters", {})
            queryset   = _build_queryset(filters)
            properties = _serialize_properties(queryset)
            reply_text = re.sub(
                r'\{[^{}]*"action"\s*:[^{}]*\}', "",
                ai_text, flags=re.DOTALL
            ).strip()
            if not reply_text:
                count = len(properties)
                reply_text = (
                    f"I found {count} propert{'y' if count == 1 else 'ies'} matching your request."
                    if count else
                    "I couldn't find an exact match. Try adjusting your filters."
                )

        return JsonResponse({
            "session_id": str(session.id),
            "reply":      reply_text,
            "action":     action,
            "properties": properties,
        })

    def dispatch(self, request, *args, **kwargs):
        try:
            return super().dispatch(request, *args, **kwargs)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@method_decorator(csrf_exempt, name="dispatch")
class ChatHistoryView(View):

    def get(self, request):
        session_id = request.GET.get("session_id")
        if not session_id:
            return JsonResponse({"error": "session_id required"}, status=400)

        messages = ChatMessage.objects.filter(
            session__id=session_id,
        ).order_by("created_at").values("role", "content", "created_at")

        return JsonResponse({"messages": list(messages)})