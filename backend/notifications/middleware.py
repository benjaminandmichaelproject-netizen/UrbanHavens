from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_by_id(user_id):
    try:
        user = User.objects.get(id=user_id)
        if getattr(user, "is_active", True):
            return user
    except User.DoesNotExist:
        pass
    return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope["user"] = AnonymousUser()

        try:
            query_string = scope.get("query_string", b"").decode("utf-8")
            query_params = parse_qs(query_string)
            token_list = query_params.get("token", [])
            token = token_list[0] if token_list else None

            if token:
                access_token = AccessToken(token)
                user_id = access_token.get("user_id")

                if user_id is not None:
                    scope["user"] = await get_user_by_id(user_id)
        except (InvalidToken, TokenError, UnicodeDecodeError, ValueError, KeyError, TypeError):
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)