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


def record_result(db: Session, ip_id: int, is_up: bool, method: CheckMethod,
                   details: str | None = None) -> dict:
    """Reglas de negocio para decidir el nuevo estado:

    - Responde y NO tiene cliente asignado  -> ACTIVE (uso detectado, sin
      registro administrativo; alguien está usando la IP).
    - Responde y SÍ tiene cliente asignado  -> se mantiene ASSIGNED.
    - No responde y estaba ACTIVE           -> vuelve a FREE (dejó de
      detectarse el uso no registrado).
    - No responde y estaba ASSIGNED         -> se mantiene ASSIGNED (la
      asignación es administrativa, no depende de que responda o no).
    """
    if isinstance(method, str):
        method = CheckMethod(method)

    ip_obj = ip_crud.get_ip(db, ip_id)
    if not ip_obj:
        raise ValueError(f"IP con id={ip_id} no existe en la base de datos.")

    previous_status = (
        ip_obj.status.value if hasattr(ip_obj.status, "value") else ip_obj.status
    )
    new_status = previous_status

    if is_up:
        if ip_obj.client_id is None:
            new_status = IPStatus.ACTIVE.value
    else:
        if previous_status == IPStatus.ACTIVE.value:
            new_status = IPStatus.FREE.value

    # Transacción atómica: el cambio de estado y su registro en el
    # historial se confirman juntos (un solo commit) o no se confirma
    # ninguno de los dos (rollback), evitando que un fallo a mitad de
    # camino deje la IP y la bitácora desincronizadas.
    try:
        if new_status != previous_status:
            ip_crud.update_ip_status(db, ip_id, IPStatus(new_status), commit=False)

        history_crud.create_history(
            db,
            ip_id=ip_id,
            previous_status=previous_status,
            new_status=new_status,
            method=method,
            details=details,
            commit=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "ip_id": ip_id,
        "is_up": is_up,
        "previous_status": previous_status,
        "new_status": new_status,
        "method": method.value,
        "details": details,
    }