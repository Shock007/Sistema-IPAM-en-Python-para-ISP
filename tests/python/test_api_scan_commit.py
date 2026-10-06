from unittest.mock import patch


@patch("app.services.range_scanner.ping_host", return_value=True)
def test_dry_run_no_persiste(mock_ping, client, seed):
    ip = seed["ip_free"].ip_address
    r = client.post("/api/v1/ips/scan", json={"start_ip": ip, "end_ip": ip, "dry_run": True})
    assert r.json()["details"][0]["evaluation"]["new_status"] == "ACTIVE"
    assert client.get("/api/v1/ips", params={"status": "ACTIVE"}).json() == []


def test_commit_actualiza_y_registra(client, seed):
    r = client.post("/api/v1/ips/scan/commit", json={
        "results": [{"ip_address": "192.168.1.10", "is_up": True},
                    {"ip_address": "192.168.1.50", "is_up": True}],
        "register_unregistered": True})
    b = r.json()
    assert (b["updated"], b["registered"], b["skipped"]) == (1, 1, 0)
    assert len(client.get("/api/v1/ips", params={"status": "ACTIVE"}).json()) == 2


def test_commit_crea_subred_y_asigna_cliente(client, seed):
    r = client.post("/api/v1/ips/scan/commit", json={
        "results": [{"ip_address": "10.7.0.5", "is_up": False}],
        "register_unregistered": True, "client_id": seed["cliente"].id,
        "new_subnet": {"cidr": "10.7.0.0/24", "name": "Nueva"}})
    assert r.status_code == 200 and r.json()["subnet_created"] == "10.7.0.0/24"
    assert r.json()["changes"][0]["new_status"] == "ASSIGNED"


def test_commit_sin_subred_omite(client, seed):
    r = client.post("/api/v1/ips/scan/commit", json={
        "results": [{"ip_address": "10.9.9.9", "is_up": True}], "register_unregistered": True})
    assert r.json()["skipped"] == 1