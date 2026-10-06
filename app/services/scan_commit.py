"""Confirma (guarda) resultados de un escaneo: actualiza/registra IPs e historial en una transacción."""
import ipaddress

from sqlalchemy.orm import Session

from app.Models.ip_address import IPAddress, IPStatus
from app.Models.ip_state_history import IPStateHistory
from app.Models.subnet import Subnet
from app.crud import ip_address as ip_crud
from app.crud import subnet as subnet_crud
from app.services.evaluation import decide_status


def _containing(nets, addr):
    best = None
    for s, n in nets:
        if n.version == addr.version and addr in n and (best is None or n.prefixlen > best[1].prefixlen):
            best = (s, n)
    return best


def commit_scan(db: Session, req) -> dict:
    nets, created = [], None
    changes, skipped = [], []
    updated = registered = 0
    try:
        for s in subnet_crud.list_subnets(db, limit=100000):
            try:
                nets.append((s, ipaddress.ip_network(s.cidr, strict=False)))
            except ValueError:
                continue

        if req.register_unregistered and req.new_subnet:
            ns = req.new_subnet
            if subnet_crud.get_subnet_by_cidr(db, ns.cidr) is None:
                sub = Subnet(cidr=ns.cidr, name=ns.name, description=ns.description, vlan_id=ns.vlan_id)
                db.add(sub)
                db.flush()
                created = sub.cidr
                nets.append((sub, ipaddress.ip_network(sub.cidr, strict=False)))

        for item in req.results:
            addr, ip_str, up = item.ip_address, str(item.ip_address), item.is_up
            note = req.details or f"scan_commit up={up}"
            obj = ip_crud.get_ip_by_address(db, ip_str)

            if obj:
                prev = obj.status.value
                if req.client_id is not None:
                    obj.client_id = req.client_id
                    new = IPStatus.ASSIGNED.value
                else:
                    new = decide_status(prev, up, obj.client_id is not None)
                obj.status = IPStatus(new)
                db.add(IPStateHistory(ip_id=obj.id, previous_status=prev, new_status=new,
                                      method=req.method, details=note))
                updated += 1
                changes.append({"ip_address": ip_str, "action": "updated",
                                "previous_status": prev, "new_status": new})
                continue

            found = _containing(nets, addr) if req.register_unregistered else None
            if not found:
                skipped.append(ip_str)
                continue
            sub, net = found
            if net.version == 4 and net.prefixlen < 31 and addr in (net.network_address, net.broadcast_address):
                skipped.append(ip_str)
                continue

            new = (IPStatus.ASSIGNED if req.client_id is not None
                   else IPStatus.ACTIVE if up else IPStatus.FREE)
            obj = IPAddress(ip_address=ip_str, subnet_id=sub.id, client_id=req.client_id, status=new)
            db.add(obj)
            db.flush()
            db.add(IPStateHistory(ip_id=obj.id, previous_status=None, new_status=new.value,
                                  method=req.method, details=note))
            registered += 1
            changes.append({"ip_address": ip_str, "action": "registered",
                            "previous_status": None, "new_status": new.value})

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"updated": updated, "registered": registered, "skipped": len(skipped),
            "subnet_created": created, "changes": changes, "skipped_ips": skipped}