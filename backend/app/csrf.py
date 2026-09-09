from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# CSRF defense for the cookie-authenticated session: SameSite=None is
# required in production (frontend and backend are different origins),
# so the cookie alone doesn't stop a cross-site form submission from
# riding along with a victim's session. CORS only gates whether the
# *response* is readable by cross-origin JS — it never blocks a
# CORS-simple request (e.g. a hidden form with
# enctype="text/plain") from being sent and executed in the first
# place, since simple requests skip the preflight entirely.
#
# Requiring a custom header on every state-changing request closes
# that gap: a browser can't attach a non-simple header without first
# sending a CORS preflight (OPTIONS), and CORSMiddleware's explicit
# origin allowlist (never "*") rejects a preflight from any origin
# that isn't the real frontend — so the actual mutating request never
# leaves the browser for an attacker's page. A plain <form> can never
# add this header at all.
CSRF_HEADER_NAME = "x-requested-with"
CSRF_HEADER_VALUE = "xmlhttprequest"
_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class RequireFetchHeaderMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        if request.method in _PROTECTED_METHODS:
            if request.headers.get(CSRF_HEADER_NAME, "").lower() != CSRF_HEADER_VALUE:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "csrf_check_failed",
                            "message": "Missing required client header.",
                            "details": None,
                        }
                    },
                )
        return await call_next(request)
