"""
Router: /api/v1/clients

- GET /api/v1/clients -> listado de clientes registrados.

Se agrega en el Paso 4 del dashboard: el modal de detalle de IP necesita
mostrar el nombre del cliente, no solo su client_id.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.schemas import ClientRead
from app.crud import client as client_crud

router = APIRouter(prefix="/api/v1/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead])
def list_clients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Listado de clientes registrados, con paginación."""
    return client_crud.list_clients(db, skip=skip, limit=limit)