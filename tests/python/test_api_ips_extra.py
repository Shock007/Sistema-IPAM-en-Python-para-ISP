"""Tests de: alta de IP, total, stats, historial, consulta única y escaneo asíncrono."""
from unittest.mock import patch

from app.crud import ip_state_history as history_crud
from app.Models.ip_state_history import CheckMethod


# --- X-Total-Count -------------------------------------------------------

def test_total_count_header(client, seed):
    r = client.get("/api/v1/ips", params={"limit": 1})
    assert len(r.json()) == 1
    assert r.headers["X-Total-Count"] == "2"
    r = client.get("/api/v1/ips", params={"status": "ASSIGNED"})
    assert r.headers["X-Total-Count"] == "1"


def test_cors_expone_total_count(client, seed):
    r = client.get("/api/v1/ips", headers={"Origin": "http://localhost:5173"})
    assert "x-total-count" in r.headers["access-control-expose-headers"].lower()


# --- POST /ips -------------------------------------------------------------

def test_create_ip_libre(client, seed):
    r = client.post("/api/v1/ips", json={"ip_address": "192.168.1.50", "subnet_id": seed["subnet"].id})
    assert r.status_code == 201
    assert r.json()["status"] == "FREE" and r.json()["client_id"] is None


def test_create_ip_con_cliente_asignada(client, seed):
    r = client.post("/api/v1/ips", json={"ip_address": "192.168.1.51",
                                         "subnet_id": seed["subnet"].id,
                                         "client_id": seed["cliente"].id})
    assert r.status_code == 201
    assert r.json()["status"] == "ASSIGNED"


def test_create_ip_duplicada_409(client, seed):
    r = client.post("/api/v1/ips", json={"ip_address": "192.168.1.10", "subnet_id": seed["subnet"].id})
    assert r.status_code == 409


def test_create_ip_fuera_de_subred_422(client, seed):
    r = client.post("/api/v1/ips", json={"ip_address": "10.9.9.9", "subnet_id": seed["subnet"].id})
    assert r.status_code == 422


def test_create_ip_red_o_broadcast_422(client, seed):
    for ip in ("192.168.1.0", "192.168.1.255"):
        r = client.post("/api/v1/ips", json={"ip_address": ip, "subnet_id": seed["subnet"].id})
        assert r.status_code == 422


def test_create_ip_subred_o_cliente_inexistente_404(client, seed):
    assert client.post("/api/v1/ips", json={"ip_address": "192.168.1.60", "subnet_id": 999}).status_code == 404
    r = client.post("/api/v1/ips", json={"ip_address": "192.168.1.60",
                                         "subnet_id": seed["subnet"].id, "client_id": 999})
    assert r.status_code == 404


# --- GET /ips/stats ----------------------------------------------------------

def test_stats(client, seed):
    client.post("/api/v1/subnets", json={"cidr": "10.5.0.0/24", "name": "Vacía"})
    body = client.get("/api/v1/ips/stats").json()
    assert (body["total"], body["free"], body["assigned"], body["active"]) == (2, 1, 1, 0)
    assert len(body["by_subnet"]) == 2
    red = next(s for s in body["by_subnet"] if s["cidr"] == "192.168.1.0/24")
    assert (red["total"], red["free"], red["assigned"]) == (2, 1, 1)


def test_stats_filtro_subred(client, seed):
    body = client.get("/api/v1/ips/stats", params={"subnet_id": 9999}).json()
    assert body["total"] == 0 and body["by_subnet"] == []


# --- GET /ips/{ip}/history ---------------------------------------------------

def test_history(client, seed, db_session):
    ip = seed["ip_free"]
    history_crud.create_history(db_session, ip.id, "FREE", "ACTIVE", CheckMethod.PING, "t1")
    history_crud.create_history(db_session, ip.id, "ACTIVE", "FREE", CheckMethod.PING, "t2")
    r = client.get(f"/api/v1/ips/{ip.ip_address}/history")
    assert r.status_code == 200
    body = r.json()
    assert [h["details"] for h in body] == ["t2", "t1"]
    assert body[0]["method"] == "PING"


def test_history_404_y_422(client, seed):
    assert client.get("/api/v1/ips/10.0.0.99/history").status_code == 404
    assert client.get("/api/v1/ips/xyz/history").status_code == 422


# --- Escaneo asíncrono: sesión propia -----------------------------------------

@patch("app.services.range_scanner.ping_host", return_value=True)
def test_scan_asincrono_usa_sesion_propia_y_registra_historial(mock_ping, client, seed):
    ip = seed["ip_free"].ip_address
    r = client.post("/api/v1/ips/scan", json={"start_ip": ip, "end_ip": ip, "run_async": True})
    assert r.status_code == 202
    hist = client.get(f"/api/v1/ips/{ip}/history").json()
    assert len(hist) == 1 and hist[0]["new_status"] == "ACTIVE"


# --- POST /ips/query ------------------------------------------------------------

@patch("app.services.single_query.ping_host", return_value=True)
def test_query_solo_ping(mock_ping, client, seed):
    r = client.post("/api/v1/ips/query", json={"ip_address": "192.168.1.10"})
    assert r.status_code == 200
    body = r.json()
    assert body["ping"] is True and body["tcp"] is None
    assert body["evaluation"]["new_status"] == "ACTIVE"


@patch("app.services.single_query.ping_host", return_value=True)
def test_query_ip_no_registrada(mock_ping, client, seed):
    body = client.post("/api/v1/ips/query", json={"ip_address": "10.0.0.5"}).json()
    assert body["evaluation"] is None and "no está registrada" in body["note"]


@patch("app.services.authorization.PROVIDER_PIN", "1234")
@patch("app.services.single_query.scan_ports")
@patch("app.services.single_query.ping_host")
def test_query_tcp_pin_invalido_403_sin_acciones(mock_ping, mock_scan, client, seed):
    r = client.post("/api/v1/ips/query", json={"ip_address": "192.168.1.10",
                                               "use_tcp": True, "pin": "0000"})
    assert r.status_code == 403
    mock_ping.assert_not_called()
    mock_scan.assert_not_called()


@patch("app.services.authorization.PROVIDER_PIN", "1234")
@patch("app.services.single_query.scan_ports", return_value={80: True, 443: False})
@patch("app.services.single_query.ping_host", return_value=False)
def test_query_tcp_pin_valido(mock_ping, mock_scan, client, seed):
    r = client.post("/api/v1/ips/query", json={"ip_address": "192.168.1.10",
                                               "use_tcp": True, "pin": "1234"})
    assert r.status_code == 200
    body = r.json()
    assert body["tcp"] == {"80": True, "443": False}
    assert body["evaluation"]["method"] == "TCP" and body["evaluation"]["new_status"] == "ACTIVE"


@patch("app.services.authorization.PROVIDER_PIN", None)
@patch("app.services.single_query.ping_host", return_value=True)
def test_query_tcp_sin_pin_configurado_500(mock_ping, client, seed):
    r = client.post("/api/v1/ips/query", json={"ip_address": "192.168.1.10",
                                               "use_tcp": True, "pin": "1"})
    assert r.status_code == 500
    assert "PROVIDER_PIN" not in r.text


@patch("app.services.authorization.PROVIDER_PIN", "1234")
@patch("app.services.single_query.ping_host", return_value=True)
def test_query_tcp_bloqueo_tras_5_fallos_429(mock_ping, client, seed):
    body = {"ip_address": "192.168.1.10", "use_tcp": True, "pin": "bad"}
    for _ in range(5):
        assert client.post("/api/v1/ips/query", json=body).status_code == 403
    assert client.post("/api/v1/ips/query", json=body).status_code == 429