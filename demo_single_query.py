"""
Ejercita manualmente la "consulta única" de la Fase 2.

Uso:
    python demo_single_query.py 8.8.8.8
    python demo_single_query.py 192.168.1.10 --tcp --pin 231451267
"""
import argparse

from app.database import SessionLocal
from app.services.single_query import query_single_ip
from app.services.authorization import UnauthorizedTCPScanError


def main() -> None:
    parser = argparse.ArgumentParser(description="Consulta única a una IP.")
    parser.add_argument("ip", help="IP a consultar")
    parser.add_argument("--tcp", action="store_true", help="Además de PING, intentar TCP")
    parser.add_argument("--pin", default=None, help="PIN de autorización del proveedor")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        result = query_single_ip(db, args.ip, use_tcp=args.tcp, provider_pin=args.pin)
        print(result)
    except UnauthorizedTCPScanError as exc:
        print(f"Autorización rechazada: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()