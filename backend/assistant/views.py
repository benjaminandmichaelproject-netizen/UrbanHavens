import json
from decimal import Decimal

from django.db.models import Q
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from .models import ChatMessage, ChatSession


def _get_user_from_request(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1]

    try:
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import AccessToken

        User = get_user_model()
        decoded = AccessToken(token)

        return User.objects.get(id=decoded["user_id"])

    except Exception:
        return None


def _get_system_prompt():
    from .prompt import build_system_prompt

    return build_system_prompt()


def _get_gemini_client():
    from django.conf import settings
    from google import genai

    return genai.Client(
        api_key=settings.GEMINI_API_KEY
    )


def _build_queryset(filters: dict):
    """
    Builds property searches for the AI assistant.

    Normal houses, hostels and single apartments use the parent
    Property bedrooms/price fields.

    Multi-unit apartments use available ApartmentUnit records for
    bedroom and price filtering because those parent fields are
    intentionally empty.
    """
    from properties.models import Property

    qs = (
        Property.objects.filter(
            is_available=True,
            report_flag_status="active",
        )
        .select_related("owner")
    )

    # Location search remains shared by every property type.
    if loc := filters.get("location"):
        qs = qs.filter(
            Q(city__icontains=loc)
            | Q(region__icontains=loc)
            | Q(school__icontains=loc)
            | Q(property_name__icontains=loc)
            | Q(description__icontains=loc)
        )

    category = filters.get("category")
    property_type = filters.get("property_type")

    # Converts the assistant's previous apartment interpretation
    # into the new first-class apartment category.
    if (
        property_type
        and "apartment" in str(property_type).lower()
        and category in {
            None,
            "",
            "house_rent",
            "apartment",
        }
    ):
        category = "apartment"
        property_type = None

    if category:
        qs = qs.filter(
            category__iexact=category
        )

    # property_type still applies to normal parent-property types.
    if property_type:
        qs = qs.filter(
            property_type__icontains=property_type
        )

    multi_unit_q = Q(
        category="apartment",
        apartment_listing_type="multi_unit",
    )

    # Conditions for properties whose rent/specifications live
    # directly on the parent Property.
    parent_constraints = Q()

    # Multi-unit conditions must all match the same available
    # ApartmentUnit relationship.
    unit_constraints = Q(
        apartment_units__status="available"
    )

    has_rental_constraint = False

    # Bedroom filtering.
    if bedrooms := filters.get("bedrooms"):
        try:
            bedrooms = int(bedrooms)

            parent_constraints &= Q(
                bedrooms=bedrooms
            )

            unit_constraints &= Q(
                apartment_units__bedrooms=bedrooms
            )

            has_rental_constraint = True

        except (ValueError, TypeError):
            pass

    # Maximum monthly rent filtering.
    if max_price := filters.get("max_price"):
        try:
            max_price = Decimal(str(max_price))

            parent_constraints &= Q(
                price__lte=max_price
            )

            unit_constraints &= Q(
                apartment_units__price__lte=max_price
            )

            has_rental_constraint = True

        except (ValueError, TypeError):
            pass

    # Minimum monthly rent filtering.
    if min_price := filters.get("min_price"):
        try:
            min_price = Decimal(str(min_price))

            parent_constraints &= Q(
                price__gte=min_price
            )

            unit_constraints &= Q(
                apartment_units__price__gte=min_price
            )

            has_rental_constraint = True

        except (ValueError, TypeError):
            pass

    # Normal rentals use parent fields.
    # Multi-unit apartments use their available unit fields.
    if has_rental_constraint:
        qs = qs.filter(
            (
                ~multi_unit_q
                & parent_constraints
            )
            |
            (
                multi_unit_q
                & unit_constraints
            )
        ).distinct()

    return qs[:10]


def _find_property_matches(filters: dict):
    """
    Returns:
        queryset, match_type

    match_type:
        exact | relaxed | fallback | none
    """

    exact_qs = _build_queryset(filters)

    if exact_qs.exists():
        return exact_qs, "exact"

    # First fallback:
    # relax price constraints while preserving other filters.
    relaxed_filters = dict(filters)

    relaxed_filters.pop(
        "max_price",
        None,
    )
    relaxed_filters.pop(
        "min_price",
        None,
    )

    relaxed_qs = _build_queryset(
        relaxed_filters
    )

    if relaxed_qs.exists():
        return relaxed_qs, "relaxed"

    # Second fallback:
    # relax bedrooms/property type but keep location/category.
    fallback_filters = {
        "location": filters.get("location"),
        "category": filters.get("category"),
    }

    fallback_qs = _build_queryset(
        fallback_filters
    )

    if fallback_qs.exists():
        return fallback_qs, "fallback"

    # Final fallback:
    # try the requested category alone.
    if filters.get("category"):
        category_only_qs = _build_queryset(
            {
                "category": filters.get(
                    "category"
                )
            }
        )

        if category_only_qs.exists():
            return category_only_qs, "fallback"

    return exact_qs, "none"


def _serialize_properties(queryset):
    """
    Serializes property results returned by the AI assistant.

    Multi-unit apartments expose apartment_listing_type and
    starting_price so the frontend can display "From GHS ..."
    instead of using the intentionally empty parent price.
    """
    try:
        from properties.serializers import (
            PropertyAssistantSerializer,
        )

        return list(
            PropertyAssistantSerializer(
                queryset,
                many=True,
            ).data
        )

    except ImportError:
        results = []

        for property_obj in queryset:
            is_multi_unit_apartment = (
                getattr(
                    property_obj,
                    "category",
                    "",
                )
                == "apartment"
                and getattr(
                    property_obj,
                    "apartment_listing_type",
                    None,
                )
                == "multi_unit"
            )

            starting_price = None

            if is_multi_unit_apartment:
                # Prefer the cheapest unit that can currently be rented.
                available_prices = list(
                    property_obj.apartment_units.filter(
                        status="available"
                    ).values_list(
                        "price",
                        flat=True,
                    )
                )

                # If every unit is currently unavailable, preserve the
                # same display fallback used by the property serializer.
                prices = (
                    available_prices
                    or list(
                        property_obj.apartment_units.values_list(
                            "price",
                            flat=True,
                        )
                    )
                )

                if prices:
                    starting_price = (
                        f"{min(prices):.2f}"
                    )

            results.append(
                {
                    "id": property_obj.id,
                    "property_name": (
                        property_obj.property_name
                    ),
                    "category": getattr(
                        property_obj,
                        "category",
                        "",
                    ),
                    "property_type": getattr(
                        property_obj,
                        "property_type",
                        "",
                    ),
                    "apartment_listing_type": getattr(
                        property_obj,
                        "apartment_listing_type",
                        None,
                    ),
                    "bedrooms": getattr(
                        property_obj,
                        "bedrooms",
                        None,
                    ),
                    "bathrooms": getattr(
                        property_obj,
                        "bathrooms",
                        None,
                    ),
                    "price": (
                        str(property_obj.price)
                        if property_obj.price
                        is not None
                        else None
                    ),
                    "starting_price": (
                        starting_price
                    ),
                    "city": getattr(
                        property_obj,
                        "city",
                        "",
                    ),
                    "region": getattr(
                        property_obj,
                        "region",
                        "",
                    ),
                    "school": getattr(
                        property_obj,
                        "school",
                        "",
                    ),
                    "is_available": getattr(
                        property_obj,
                        "is_available",
                        True,
                    ),
                    "thumbnail": None,
                    "owner_name": getattr(
                        property_obj,
                        "owner_name",
                        None,
                    ),
                    "owner_phone": getattr(
                        property_obj,
                        "owner_phone",
                        None,
                    ),
                    "owner_email": getattr(
                        property_obj,
                        "owner_email",
                        None,
                    ),
                }
            )

        return results


def _extract_action(text: str):
    start = text.find("{")
    end = text.rfind("}")

    if (
        start == -1
        or end == -1
        or end <= start
    ):
        return None

    possible_json = text[
        start:end + 1
    ]

    try:
        data = json.loads(
            possible_json
        )

        if (
            isinstance(data, dict)
            and data.get("action")
        ):
            return data

    except json.JSONDecodeError:
        pass

    return None


def _build_gemini_contents(
    system_prompt,
    history,
    user_message,
):
    transcript = [
        f"SYSTEM:\n{system_prompt}"
    ]

    for history_item in history:
        role = history_item[
            "role"
        ].upper()

        transcript.append(
            f"{role}:\n"
            f"{history_item['content']}"
        )

    transcript.append(
        f"USER:\n{user_message}"
    )

    transcript.append(
        "Reply exactly according to the system rules. "
        "If property search is needed, include the raw "
        "JSON action block."
    )

    return "\n\n".join(
        transcript
    )


@method_decorator(
    csrf_exempt,
    name="dispatch",
)
class AssistantChatView(View):
    def post(self, request):
        try:
            body = json.loads(
                request.body
            )

        except json.JSONDecodeError:
            return JsonResponse(
                {
                    "error": "Invalid JSON"
                },
                status=400,
            )

        user_message = body.get(
            "message",
            "",
        ).strip()

        session_id = body.get(
            "session_id"
        )

        if not user_message:
            return JsonResponse(
                {
                    "error": (
                        "Message is required"
                    )
                },
                status=400,
            )

        user = _get_user_from_request(
            request
        )

        session = None

        if session_id:
            if user:
                session = (
                    ChatSession.objects.filter(
                        id=session_id,
                        user=user,
                    ).first()
                )

            else:
                session = (
                    ChatSession.objects.filter(
                        id=session_id,
                        user=None,
                    ).first()
                )

        if not session:
            session = (
                ChatSession.objects.create(
                    user=user
                )
            )

        history = list(
            ChatMessage.objects
            .filter(
                session=session
            )
            .order_by(
                "-created_at"
            )[:10]
            .values(
                "role",
                "content",
            )
        )

        history.reverse()

        system_prompt = (
            _get_system_prompt()
        )

        prompt_text = (
            _build_gemini_contents(
                system_prompt,
                history,
                user_message,
            )
        )

        try:
            client = (
                _get_gemini_client()
            )

            response = (
                client.models.generate_content(
                    model=(
                        "gemini-2.5-flash"
                    ),
                    contents=prompt_text,
                )
            )

            ai_text = (
                response.text or ""
            ).strip()

        except Exception as error:
            import traceback

            traceback.print_exc()

            return JsonResponse(
                {
                    "error": (
                        f"AI error: {str(error)}"
                    ),
                    "detail": (
                        traceback.format_exc()
                    ),
                },
                status=500,
            )

        ChatMessage.objects.create(
            session=session,
            role="user",
            content=user_message,
        )

        ChatMessage.objects.create(
            session=session,
            role="assistant",
            content=ai_text,
        )

        session.save()

        action = _extract_action(
            ai_text
        )

        properties = []
        reply_text = ai_text

        if (
            action
            and action.get("action")
            == "search_property"
        ):
            filters = action.get(
                "filters",
                {},
            )

            queryset, match_type = (
                _find_property_matches(
                    filters
                )
            )

            properties = (
                _serialize_properties(
                    queryset
                )
            )

            count = len(
                properties
            )

            if match_type == "exact":
                reply_text = (
                    f"I found {count} matching "
                    f"propert"
                    f"{'y' if count == 1 else 'ies'} "
                    f"for you."
                )

            elif match_type == "relaxed":
                reply_text = (
                    "I couldn't find the exact match, "
                    f"but I found {count} similar "
                    f"propert"
                    f"{'y' if count == 1 else 'ies'} "
                    "for you."
                )

            elif match_type == "fallback":
                reply_text = (
                    "I couldn't find the exact property "
                    "you asked for, but here are "
                    f"{count} alternative propert"
                    f"{'y' if count == 1 else 'ies'} "
                    "you may like."
                )

            else:
                reply_text = (
                    "I couldn't find a matching property "
                    "right now. Try another location, a "
                    "higher budget, or ask me for nearby "
                    "areas."
                )

        return JsonResponse(
            {
                "session_id": str(
                    session.id
                ),
                "reply": reply_text,
                "action": action,
                "properties": properties,
            }
        )


class ChatHistoryView(View):
    def get(self, request):
        user = _get_user_from_request(
            request
        )

        session_id = request.GET.get(
            "session_id"
        )

        if not session_id:
            return JsonResponse(
                {
                    "error": (
                        "session_id is required"
                    )
                },
                status=400,
            )

        session = None

        if user:
            session = (
                ChatSession.objects.filter(
                    id=session_id,
                    user=user,
                ).first()
            )

        else:
            session = (
                ChatSession.objects.filter(
                    id=session_id,
                    user=None,
                ).first()
            )

        if not session:
            return JsonResponse(
                {
                    "error": (
                        "Session not found"
                    )
                },
                status=404,
            )

        messages = list(
            ChatMessage.objects
            .filter(
                session=session
            )
            .order_by(
                "created_at"
            )
            .values(
                "id",
                "role",
                "content",
                "created_at",
            )
        )

        return JsonResponse(
            {
                "session_id": str(
                    session.id
                ),
                "messages": messages,
            }
        )