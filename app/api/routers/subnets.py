"""
Router: /api/v1/subnets

- GET /api/v1/subnets -> listado de subredes registradas.

Se agrega en la Fase 4 porque el dashboard necesita agrupar el grid de IPs
por subred; hasta ahora `crud.subnet.list_subnets` existía pero no estaba
expuesto por ningún router.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.schemas import SubnetRead
from app.crud import subnet as subnet_crud

router = APIRouter(prefix="/api/v1/subnets", tags=["subnets"])


@router.get("", response_model=list[SubnetRead])
def list_subnets(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Listado de subredes registradas, con paginación."""
    return subnet_crud.list_subnets(db, skip=skip, limit=limit)