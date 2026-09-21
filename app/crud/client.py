from sqlalchemy import select
from sqlalchemy.orm import Session

from app.Models.client import Client


def create_client(db: Session, full_name: str, document_id: str | None = None,
                   email: str | None = None, phone: str | None = None,
                   address: str | None = None, wisphub_client_id: str | None = None) -> Client:
    obj = Client(
        full_name=full_name, document_id=document_id, email=email,
        phone=phone, address=address, wisphub_client_id=wisphub_client_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_client(db: Session, client_id: int) -> Client | None:
    return db.get(Client, client_id)


def list_clients(db: Session, skip: int = 0, limit: int = 100,
                  only_active: bool = False) -> list[Client]:
    stmt = select(Client)
    if only_active:
        stmt = stmt.where(Client.is_active.is_(True))
    return list(db.scalars(stmt.offset(skip).limit(limit)))


def update_client(db: Session, client_id: int, **fields) -> Client | None:
    obj = db.get(Client, client_id)
    if not obj:
        return None
    for key, value in fields.items():
        if hasattr(obj, key) and value is not None:
            setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


def deactivate_client(db: Session, client_id: int) -> Client | None:
    return update_client(db, client_id, is_active=False)


def delete_client(db: Session, client_id: int) -> bool:
    obj = db.get(Client, client_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True
