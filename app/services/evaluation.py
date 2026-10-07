"""
Módulo de Evaluación: agrega el resultado de una verificación (PING, TCP,
WispHub o manual), decide el nuevo estado de la IP y lo registra en
ip_state_history, actualizando también ip_addresses.status si corresponde.
"""
from sqlalchemy.orm import Session

from app.Models.ip_address import IPStatus
from app.Models.ip_state_history import CheckMethod
from app.crud import ip_address as ip_crud
from app.crud import ip_state_history as history_crud


def decide_status(previous_status: str, is_up: bool, has_client: bool) -> str:
    """Reglas de negocio para decidir el nuevo estado:

    - Responde y NO tiene cliente -> ACTIVE (uso detectado sin registro).
    - Responde y SÍ tiene cliente -> se mantiene (ASSIGNED).
    - No responde y estaba ACTIVE -> vuelve a FREE.
    - No responde y estaba ASSIGNED/FREE -> se mantiene (la asignación es
      administrativa).
    """
    new_status = previous_status
    if is_up:
        if not has_client:
            new_status = IPStatus.ACTIVE.value
    elif previous_status == IPStatus.ACTIVE.value:
        new_status = IPStatus.FREE.value
    return new_status


def record_result(db: Session, ip_id: int, is_up: bool, method: CheckMethod,
                   details: str | None = None, persist: bool = True) -> dict:
    """Evalúa el resultado y, si persist=True, actualiza el estado y registra
    el historial en una única transacción atómica. Con persist=False solo
    devuelve la vista previa sin tocar la base de datos."""
    if isinstance(method, str):
        method = CheckMethod(method)

    ip_obj = ip_crud.get_ip(db, ip_id)
    if not ip_obj:
        raise ValueError(f"IP con id={ip_id} no existe en la base de datos.")

    previous_status = (
        ip_obj.status.value if hasattr(ip_obj.status, "value") else ip_obj.status
    )
    new_status = decide_status(previous_status, is_up, ip_obj.client_id is not None)

    result = {
        "ip_id": ip_id, "is_up": is_up, "previous_status": previous_status,
        "new_status": new_status, "method": method.value, "details": details,
    }
    if not persist:  # vista previa
        return result

    try:
        if new_status != previous_status:
            ip_crud.update_ip_status(db, ip_id, IPStatus(new_status), commit=False)
        history_crud.create_history(
            db, ip_id=ip_id, previous_status=previous_status, new_status=new_status,
            method=method, details=details, commit=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result