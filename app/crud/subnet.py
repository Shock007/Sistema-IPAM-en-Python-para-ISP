from sqlalchemy import select
from sqlalchemy.orm import Session

from app.Models.subnet import Subnet


def create_subnet(db: Session, cidr: str, name: str, description: str | None = None,
                   vlan_id: int | None = None) -> Subnet:
    obj = Subnet(cidr=cidr, name=name, description=description, vlan_id=vlan_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_subnet(db: Session, subnet_id: int) -> Subnet | None:
    return db.get(Subnet, subnet_id)


def get_subnet_by_cidr(db: Session, cidr: str) -> Subnet | None:
    return db.scalar(select(Subnet).where(Subnet.cidr == cidr))


def list_subnets(db: Session, skip: int = 0, limit: int = 100) -> list[Subnet]:
    return list(db.scalars(select(Subnet).offset(skip).limit(limit)))


def update_subnet(db: Session, subnet_id: int, **fields) -> Subnet | None:
    obj = db.get(Subnet, subnet_id)
    if not obj:
        return None
    for key, value in fields.items():
        if hasattr(obj, key) and value is not None:
            setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_subnet(db: Session, subnet_id: int) -> bool:
    obj = db.get(Subnet, subnet_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True
