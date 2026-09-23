"""
Tests de la API REST /api/v1/ips (Fase 3).

Ejecutar:
    pytest tests/python -v
"""
from unittest.mock import patch


# --- GET /api/v1/ips -----------------------------------------------------

def test_list_ips_sin_filtros(client, seed):
    r = client.get("/api/v1/ips")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    assert {ip["ip_address"] for ip in body} == {"192.168.1.10", "192.168.1.11"}


def test_list_ips_filtro_status(client, seed):
    r = client.get("/api/v1/ips", params={"status": "ASSIGNED"})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["ip_address"] == "192.168.1.11"
    assert body[0]["client_id"] == seed["cliente"].id


def test_list_ips_filtro_subnet(client, seed):
    r = client.get("/api/v1/ips", params={"subnet_id": seed["subnet"].id})
    assert r.status_code == 200
    assert len(r.json()) == 2

    r = client.get("/api/v1/ips", params={"subnet_id": 9999})
    assert r.status_code == 200
    assert r.json() == []


def test_list_ips_status_invalido_422(client, seed):
    r = client.get("/api/v1/ips", params={"status": "NO_EXISTE"})
    assert r.status_code == 422


def test_list_ips_paginacion(client, seed):
    r = client.get("/api/v1/ips", params={"limit": 1, "skip": 0})
    assert r.status_code == 200
    assert len(r.json()) == 1


# --- PUT /api/v1/ips/{ip}/assign -----------------------------------------

def test_assign_ip_existente_ok(client, seed):
    r = client.put(
        f"/api/v1/ips/{seed['ip_free'].ip_address}/assign",
        json={
            "client_id": seed["cliente"].id,
            "description": "Router principal",
            "status": "ASSIGNED",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ASSIGNED"
    assert body["client_id"] == seed["cliente"].id
    assert body["description"] == "Router principal"


def test_assign_ip_desasignar_ok(client, seed):
    r = client.put(
        f"/api/v1/ips/{seed['ip_assigned'].ip_address}/assign",
        json={"client_id": None, "status": "FREE"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "FREE"
    assert body["client_id"] is None


def test_assign_ip_inexistente_404(client, seed):
    # Body válido (FREE sin client_id) para aislar el 404 de "IP no encontrada"
    # del 422 de reglas de negocio (ver test_assign_status_*).
    r = client.put(
        "/api/v1/ips/10.0.0.99/assign",
        json={"description": "no existe", "status": "FREE"},
    )
    assert r.status_code == 404


def test_assign_ip_formato_invalido_422(client, seed):
    r = client.put("/api/v1/ips/no-es-una-ip/assign", json={"description": "x"})
    assert r.status_code == 422


def test_assign_cliente_inexistente_404(client, seed):
    r = client.put(
        f"/api/v1/ips/{seed['ip_free'].ip_address}/assign",
        json={"client_id": 9999, "status": "ASSIGNED"},
    )
    assert r.status_code == 404
    assert "cliente" in r.json()["detail"].lower()


def test_assign_status_assigned_sin_client_id_422(client, seed):
    r = client.put(
        f"/api/v1/ips/{seed['ip_free'].ip_address}/assign",
        json={"status": "ASSIGNED"},
    )
    assert r.status_code == 422


def test_assign_status_free_con_client_id_422(client, seed):
    r = client.put(
        f"/api/v1/ips/{seed['ip_free'].ip_address}/assign",
        json={"client_id": seed["cliente"].id, "status": "FREE"},
    )
    assert r.status_code == 422


def test_assign_status_active_prohibido_422(client, seed):
    r = client.put(
        f"/api/v1/ips/{seed['ip_free'].ip_address}/assign",
        json={"status": "ACTIVE"},
    )
    assert r.status_code == 422


# --- POST /api/v1/ips/scan ------------------------------------------------

def test_scan_sin_parametros_422(client, seed):
    r = client.post("/api/v1/ips/scan", json={})
    assert r.status_code == 422


def test_scan_formato_ip_invalido_422(client, seed):
    r = client.post(
        "/api/v1/ips/scan",
        json={"start_ip": "300.1.1.1", "end_ip": "300.1.1.2"},
    )
    assert r.status_code == 422


def test_scan_rango_supera_maximo_400(client, seed):
    r = client.post(
        "/api/v1/ips/scan",
        json={"address": "10.0.0.0", "netmask": "8"},  # ~16M hosts, supera MAX_HOSTS_PER_SCAN
    )
    assert r.status_code == 400


@patch("app.services.range_scanner.ping_host")
def test_scan_sincrono_devuelve_resumen(mock_ping, client, seed):
    # Simula: la IP FREE responde, la ASSIGNED no.
    mock_ping.side_effect = lambda ip, timeout=2: ip == seed["ip_free"].ip_address

    r = client.post(
        "/api/v1/ips/scan",
        json={
            "start_ip": seed["ip_free"].ip_address,
            "end_ip": seed["ip_assigned"].ip_address,
            "run_async": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["up"] == 1
    assert body["registered"] == 2

    # La IP FREE que respondió sin cliente debe pasar a ACTIVE.
    detalle = client.get("/api/v1/ips", params={"status": "ACTIVE"}).json()
    assert len(detalle) == 1
    assert detalle[0]["ip_address"] == seed["ip_free"].ip_address


@patch("app.services.range_scanner.ping_host")
def test_scan_asincrono_devuelve_202(mock_ping, client, seed):
    mock_ping.return_value = False

    r = client.post(
        "/api/v1/ips/scan",
        json={
            "start_ip": seed["ip_free"].ip_address,
            "end_ip": seed["ip_free"].ip_address,
            "run_async": True,
        },
    )
    assert r.status_code == 202
    body = r.json()
    assert body["total_ips"] == 1
    assert "segundo plano" in body["message"]