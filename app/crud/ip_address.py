from sqlalchemy import select
from sqlalchemy.orm import Session

from app.Models.ip_address import IPAddress, IPStatus


def create_ip(db: Session, ip_address: str, subnet_id: int,
              client_id: int | None = None, status: IPStatus = IPStatus.FREE,
              description: str | None = None) -> IPAddress:
    obj = IPAddress(
        ip_address=ip_address, subnet_id=subnet_id, client_id=client_id,
        status=status, description=description,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_ip(db: Session, ip_id: int) -> IPAddress | None:
    return db.get(IPAddress, ip_id)


def get_ip_by_address(db: Session, ip_address: str) -> IPAddress | None:
    return db.scalar(select(IPAddress).where(IPAddress.ip_address == ip_address))


def list_ips(db: Session, subnet_id: int | None = None, status: IPStatus | None = None,
             skip: int = 0, limit: int = 100) -> list[IPAddress]:
    stmt = select(IPAddress)
    if subnet_id is not None:
        stmt = stmt.where(IPAddress.subnet_id == subnet_id)
    if status is not None:
        stmt = stmt.where(IPAddress.status == status)
    return list(db.scalars(stmt.offset(skip).limit(limit)))


def assign_ip(db: Session, ip_id: int, client_id: int | None, description: str | None = None,
              status: IPStatus = IPStatus.ASSIGNED) -> IPAddress | None:
    """Asigna (o desasigna si client_id=None) un titular a una IP."""
    obj = db.get(IPAddress, ip_id)
    if not obj:
        return None
    obj.client_id = client_id
    obj.status = status
    if description is not None:
        obj.description = description
    db.commit()
    db.refresh(obj)
    return obj


def update_ip_status(db: Session, ip_id: int, status: IPStatus,
                      commit: bool = True) -> IPAddress | None:
    """Actualiza el estado de una IP.

    `commit=False` permite que el llamador (p. ej. el Módulo de Evaluación)
    agrupe este cambio junto con otra operación (como insertar en
    ip_state_history) dentro de una misma transacción atómica.
    """
    obj = db.get(IPAddress, ip_id)
    if not obj:
        return None
    obj.status = status
    if commit:
        db.commit()
        db.refresh(obj)
    else:
        db.flush()
    return obj


def delete_ip(db: Session, ip_id: int) -> bool:
    obj = db.get(IPAddress, ip_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True