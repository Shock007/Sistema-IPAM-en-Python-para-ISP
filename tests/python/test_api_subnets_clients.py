"""Tests CRUD de /api/v1/subnets y /api/v1/clients."""


def test_subnet_create_normaliza_cidr(client):
    r = client.post("/api/v1/subnets", json={"cidr": "10.0.0.7/24", "name": "Norte", "vlan_id": 10})
    assert r.status_code == 201
    assert r.json()["cidr"] == "10.0.0.0/24"


def test_subnet_create_duplicada_409(client, seed):
    r = client.post("/api/v1/subnets", json={"cidr": "192.168.1.0/24", "name": "X"})
    assert r.status_code == 409


def test_subnet_cidr_invalido_422(client):
    assert client.post("/api/v1/subnets", json={"cidr": "abc", "name": "X"}).status_code == 422
    assert client.post("/api/v1/subnets", json={"cidr": "10.0.0.0", "name": "X"}).status_code == 422


def test_subnet_get_y_404(client, seed):
    assert client.get(f"/api/v1/subnets/{seed['subnet'].id}").status_code == 200
    assert client.get("/api/v1/subnets/9999").status_code == 404


def test_subnet_update(client, seed):
    r = client.put(f"/api/v1/subnets/{seed['subnet'].id}", json={"name": "Renombrada", "vlan_id": 20})
    assert r.status_code == 200
    assert r.json()["name"] == "Renombrada" and r.json()["vlan_id"] == 20
    assert r.json()["cidr"] == "192.168.1.0/24"


def test_subnet_delete_con_ips_requiere_force(client, seed):
    sid = seed["subnet"].id
    assert client.delete(f"/api/v1/subnets/{sid}").status_code == 409
    assert client.delete(f"/api/v1/subnets/{sid}", params={"force": True}).status_code == 204
    assert client.get("/api/v1/ips").json() == []


def test_subnet_delete_vacia_204(client):
    sid = client.post("/api/v1/subnets", json={"cidr": "10.1.0.0/24", "name": "V"}).json()["id"]
    assert client.delete(f"/api/v1/subnets/{sid}").status_code == 204


def test_client_create_y_wisphub_id(client):
    r = client.post("/api/v1/clients", json={"full_name": "Ana", "document_id": "111",
                                             "wisphub_client_id": "W-9"})
    assert r.status_code == 201
    assert r.json()["wisphub_client_id"] == "W-9"


def test_client_document_duplicado_409(client):
    body = {"full_name": "Ana", "document_id": "111"}
    assert client.post("/api/v1/clients", json=body).status_code == 201
    assert client.post("/api/v1/clients", json=body).status_code == 409


def test_client_document_vacio_no_colisiona(client):
    body = {"full_name": "Ana", "document_id": ""}
    assert client.post("/api/v1/clients", json=body).status_code == 201
    assert client.post("/api/v1/clients", json=body).status_code == 201


def test_client_update_y_desactivar(client, seed):
    cid = seed["cliente"].id
    r = client.put(f"/api/v1/clients/{cid}", json={"phone": "555", "is_active": False})
    assert r.status_code == 200
    assert r.json()["phone"] == "555" and r.json()["is_active"] is False
    assert client.get("/api/v1/clients", params={"only_active": True}).json() == []


def test_client_404(client):
    assert client.get("/api/v1/clients/9999").status_code == 404
    assert client.put("/api/v1/clients/9999", json={"phone": "1"}).status_code == 404
    assert client.delete("/api/v1/clients/9999").status_code == 404


def test_client_delete_libera_ips(client, seed):
    r = client.delete(f"/api/v1/clients/{seed['cliente'].id}")
    assert r.status_code == 204
    libres = client.get("/api/v1/ips", params={"status": "FREE"}).json()
    assert len(libres) == 2
    assert all(ip["client_id"] is None for ip in libres)