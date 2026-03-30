"""
system_logs/middleware.py

Automatically captures every 4xx and 5xx HTTP response and writes a
SystemLog record so that API errors appear in the dashboard without
requiring any changes to individual views.
"""


class APIErrorLoggingMiddleware:
    """
    Django middleware that intercepts outgoing responses and logs any
    with a status code of 400 or above to the SystemLog table.

    Install by adding to MIDDLEWARE in settings.py (after
    SessionMiddleware and AuthenticationMiddleware so request.user
    is available):

        MIDDLEWARE = [
            ...
            "system_logs.middleware.APIErrorLoggingMiddleware",
        ]
    """

    # Paths we never want to log (would create infinite loops or noise)
    IGNORED_PATHS = [
        "/api/system-logs/",
        "/admin/",
        "/static/",
        "/media/",
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only log error responses (4xx and 5xx)
        if response.status_code >= 400:
            self._log_error(request, response)

        return response

    def _log_error(self, request, response):
        """Write a SystemLog record for an error response."""

        # Skip ignored paths to avoid noise
        for ignored in self.IGNORED_PATHS:
            if request.path.startswith(ignored):
                return

        # Skip OPTIONS preflight requests — these are never real errors
        if request.method == "OPTIONS":
            return

        try:
            from system_logs.logger import log_api_error

            # Resolve the user if authenticated
            user = None
            if hasattr(request, "user") and request.user.is_authenticated:
                user = request.user

            # Try to decode the response body for the detail field
            detail = ""
            try:
                detail = response.content.decode("utf-8")[:1000]
            except Exception:
                pass

            log_api_error(
                message=(
                    f"{request.method} {request.path} "
                    f"returned {response.status_code}"
                ),
                endpoint=request.path,
                status_code=response.status_code,
                user=user,
                detail=detail,
            )
        except Exception:
            # Never let logging crash the response
            pass