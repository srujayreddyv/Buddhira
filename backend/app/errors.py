"""
Single error response format for all API errors.
Frontend can always read body.detail for toast messages.
"""

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# HTTPException is used in handler registration in main.py



def detail_message(exc: Exception) -> str:
    """Normalize any exception to a single detail string."""
    if hasattr(exc, "detail"):
        d = exc.detail
        if isinstance(d, str):
            return d
        if isinstance(d, list):
            parts = []
            for e in d:
                if isinstance(e, dict) and "msg" in e:
                    loc = e.get("loc", [])
                    loc_str = ".".join(str(x) for x in loc if x != "body")
                    parts.append(f"{loc_str}: {e['msg']}" if loc_str else e["msg"])
                else:
                    parts.append(str(e))
            return " ".join(parts) if parts else "Validation error"
        return str(d)
    return str(exc) or "An error occurred"


def error_response(status_code: int, detail: str, code: str | None = None) -> JSONResponse:
    """Return JSON in a single format: { detail, code? }."""
    body: dict = {"detail": detail}
    if code:
        body["code"] = code
    return JSONResponse(status_code=status_code, content=body)


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle FastAPI HTTPException."""
    status_code = getattr(exc, "status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
    code = getattr(exc, "code", None)
    return error_response(status_code, detail_message(exc), code)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle 422 validation errors in the same format."""
    return error_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail_message(exc),
        code="validation_error",
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all so frontend never gets an unexpected shape. Do not leak internal details."""
    import logging
    logging.getLogger("buddhira").exception("Unhandled exception")
    return error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "An error occurred",
        code="internal_error",
    )
