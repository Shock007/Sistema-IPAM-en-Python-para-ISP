"""
Ejercita el CRUD manualmente. Requiere que las migraciones ya se hayan
aplicado (alembic upgrade head) y DATABASE_URL configurada en .env.

Uso:
    python demo_crud.py
"""
from app.database import SessionLocal
from app.crud import subnet as subnet_crud
from app.crud import client as client_crud
from app.crud import ip_address as ip_crud
from app.Models.ip_address import IPStatus


def main() -> None:
    db = SessionLocal()
    try:
        red = subnet_crud.create_subnet(
            db, cidr="192.168.1.0/24", name="Red Sector Norte", vlan_id=10,
        )
        print("Subred creada:", red)

        cliente = client_crud.create_client(
            db, full_name="Juan Perez", document_id="0102030405", email="juan@example.com",
        )
        print("Cliente creado:", cliente)

        ip = ip_crud.create_ip(db, ip_address="192.168.1.10", subnet_id=red.id)
        print("IP creada:", ip)

        ip = ip_crud.assign_ip(db, ip.id, client_id=cliente.id, description="Router principal")
        print("IP asignada:", ip)

        libres = ip_crud.list_ips(db, subnet_id=red.id, status=IPStatus.ASSIGNED)
        print("IPs asignadas en la subred:", libres)
    finally:
        db.close()


if __name__ == "__main__":
    main()
