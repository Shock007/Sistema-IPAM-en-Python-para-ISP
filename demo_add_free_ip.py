"""
Crea una IP de prueba en estado FREE (sin cliente asignado), para verificar
el color verde en el dashboard.

Uso:
    python demo_add_free_ip.py 192.168.1.20
    python demo_add_free_ip.py 192.168.1.20 --subnet-id 1
"""
import argparse

from app.database import SessionLocal
from app.crud import subnet as subnet_crud
from app.crud import ip_address as ip_crud


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea una IP de prueba en estado FREE.")
    parser.add_argument("ip", help="Dirección IP a crear, ej. 192.168.1.20")
    parser.add_argument(
        "--subnet-id", type=int, default=None,
        help="ID de la subred. Si se omite, usa la primera subred registrada.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        subnet_id = args.subnet_id
        if subnet_id is None:
            subredes = subnet_crud.list_subnets(db, limit=1)
            if not subredes:
                print("No hay subredes registradas. Crea una primero (ver demo_crud.py).")
                return
            subnet_id = subredes[0].id
            print(f"Usando subred existente: id={subnet_id} ({subredes[0].cidr})")

        existente = ip_crud.get_ip_by_address(db, args.ip)
        if existente:
            print(f"La IP {args.ip} ya existe (id={existente.id}, status={existente.status}). "
                  "No se crea de nuevo.")
            return

        # status=FREE es el valor por defecto de create_ip; no se llama a
        # assign_ip, por lo que queda sin cliente ni descripción.
        nueva = ip_crud.create_ip(db, ip_address=args.ip, subnet_id=subnet_id)
        print(f"IP creada: {nueva.ip_address} (id={nueva.id}, status={nueva.status.value})")
    finally:
        db.close()


if __name__ == "__main__":
    main()