"""
Ejercita manualmente el escaneo por rango de la Fase 2 (solo PING).

Uso con rango explícito:
    python demo_range_scan.py --start 192.168.1.1 --end 192.168.1.254

Uso con dirección + máscara:
    python demo_range_scan.py --address 192.168.1.10 --netmask 24
    python demo_range_scan.py --address 192.168.1.10 --netmask 255.255.255.0
"""
import argparse

from app.database import SessionLocal
from app.services.range_scanner import build_ip_list, run_range_scan


def main() -> None:
    parser = argparse.ArgumentParser(description="Escaneo por rango (solo PING).")
    parser.add_argument("--start", help="IP inicial del rango")
    parser.add_argument("--end", help="IP final del rango")
    parser.add_argument("--address", help="Dirección IP para deducir el rango junto a --netmask")
    parser.add_argument("--netmask", help="Máscara de red (ej. 24 o 255.255.255.0)")
    parser.add_argument("--concurrency", type=int, default=30, help="Pings simultáneos")
    args = parser.parse_args()

    ips = build_ip_list(
        start_ip=args.start, end_ip=args.end,
        address=args.address, netmask=args.netmask,
    )
    print(f"Escaneando {len(ips)} IPs (concurrencia={args.concurrency})...")

    db = SessionLocal()
    try:
        summary = run_range_scan(db, ips, concurrency=args.concurrency)
        print(f"Total: {summary['total']} | Activas: {summary['up']} | "
              f"Sin respuesta: {summary['down']} | "
              f"Registradas en BD: {summary['registered']} | "
              f"No registradas: {summary['unregistered']}")
        for entry in summary["details"]:
            estado = "UP" if entry["is_up"] else "down"
            print(f"  {entry['ip_address']:<15} {estado}")
    except ValueError as exc:
        print(f"Error: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()