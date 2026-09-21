"""
Adaptador para la API de WispHub.

La API real (endpoints, autenticación, formato de respuesta) todavía no ha
sido facilitada. Este módulo deja la interfaz y la lógica de orquestación
listas para conectarse en cuanto se disponga de credenciales/documentación,
sin bloquear el resto de la Fase 2.

Uso previsto (Fase 2 / Fase 3):
    adapter = WispHubAdapter(base_url=..., api_key=...)
    servicios = adapter.get_services_by_ip("192.168.1.10")
"""
from dataclasses import dataclass


@dataclass
class WispHubService:
    client_id: str
    ip_address: str
    status: str  # p.ej. "activo" / "suspendido" (según defina la API real)
    raw: dict


class WispHubAdapter:
    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        self.base_url = base_url
        self.api_key = api_key

    def _request(self, method: str, path: str, **kwargs):
        """Punto único de entrada HTTP. Pendiente de implementar (httpx/
        requests) con la autenticación y el parseo reales cuando el
        proveedor entregue la documentación de la API."""
        raise NotImplementedError(
            "La API de WispHub aún no ha sido facilitada. Implementar aquí "
            "la llamada HTTP real (auth, endpoint, parseo de respuesta)."
        )

    def get_services_by_ip(self, ip_address: str) -> list[WispHubService]:
        """Debe devolver los servicios/clientes activos asociados a una IP."""
        self._request("GET", "/services", params={"ip": ip_address})
        return []

    def get_client_status(self, wisphub_client_id: str) -> str | None:
        """Debe devolver el estado del cliente (activo/suspendido) en WispHub."""
        self._request("GET", f"/clients/{wisphub_client_id}")
        return None