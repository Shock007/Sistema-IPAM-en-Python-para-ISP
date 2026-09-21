from sqlalchemy import select
from sqlalchemy.orm import Session

from app.Models.ip_state_history import IPStateHistory, CheckMethod


def create_history(db: Session, ip_id: int, previous_status: str | None,
                    new_status: str, method: CheckMethod,
                    details: str | None = None) -> IPStateHistory:
    """Inserta una fila de bitácora. Se llama desde el módulo de Evaluación
    cada vez que se ejecuta una verificación (PING, TCP, WispHub, manual)."""
    obj = IPStateHistory(
        ip_id=ip_id,
        previous_status=previous_status,
        new_status=new_status,
        method=method,
        details=details,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_history(db: Session, ip_id: int, limit: int = 50) -> list[IPStateHistory]:
    stmt = (
        select(IPStateHistory)
        .where(IPStateHistory.ip_id == ip_id)
        .order_by(IPStateHistory.checked_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))