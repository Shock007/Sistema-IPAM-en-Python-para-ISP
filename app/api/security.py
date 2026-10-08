"""Protección de endpoints administrativos (escriben .env)."""
import hmac
import os

from fastapi import Header, HTTPException, Request, status

from app.api.rate_limit import pin_limiter

LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost"}


def require_admin(request: Request, x_admin_pin: str | None = Header(default=None)) -> None:
    host = request.client.host if request.client else ""
    if host not in LOCAL_HOSTS:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "La configuración solo puede modificarse desde el propio servidor (localhost).")

    pin = os.getenv("PROVIDER_PIN")  # se lee en cada request: refleja cambios del PUT
    if not pin:
        return  # primera configuración: basta con localhost

    key = f"admin:{host}"
    pin_limiter.check(key)
    if not x_admin_pin or not hmac.compare_digest(x_admin_pin.encode(), pin.encode()):
        pin_limiter.register_failure(key)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "PIN de administrador inválido.")
    pin_limiter.reset(key)