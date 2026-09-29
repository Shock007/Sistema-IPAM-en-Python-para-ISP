"""Router: /api/v1/subnets (listado, detalle, alta, edición y baja)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.schemas import SubnetCreate, SubnetRead, SubnetUpdate
from app.crud import ip_address as ip_crud
from app.crud import subnet as subnet_crud

router = APIRouter(prefix="/api/v1/subnets", tags=["subnets"])


def _get_or_404(db: Session, subnet_id: int):
    obj = subnet_crud.get_subnet(db, subnet_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"La subred id={subnet_id} no existe.")
    return obj


@router.get("", response_model=list[SubnetRead])
def list_subnets(skip: int = Query(default=0, ge=0),
                 limit: int = Query(default=100, ge=1, le=500),
                 db: Session = Depends(get_db)):
    return subnet_crud.list_subnets(db, skip=skip, limit=limit)


@router.get("/{subnet_id}", response_model=SubnetRead)
def get_subnet(subnet_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, subnet_id)


@router.post("", response_model=SubnetRead, status_code=status.HTTP_201_CREATED)
def create_subnet(payload: SubnetCreate, db: Session = Depends(get_db)):
    if subnet_crud.get_subnet_by_cidr(db, payload.cidr):
        raise HTTPException(status.HTTP_409_CONFLICT, f"La subred {payload.cidr} ya existe.")
    try:
        return subnet_crud.create_subnet(db, **payload.model_dump())
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"La subred {payload.cidr} ya existe.") from exc


@router.put("/{subnet_id}", response_model=SubnetRead)
def update_subnet(subnet_id: int, payload: SubnetUpdate, db: Session = Depends(get_db)):
    _get_or_404(db, subnet_id)
    fields = payload.model_dump(exclude_unset=True)
    return subnet_crud.update_subnet(db, subnet_id, **fields)


@router.delete("/{subnet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subnet(subnet_id: int,
                  force: bool = Query(default=False, description="Borra también sus IPs e historial."),
                  db: Session = Depends(get_db)):
    _get_or_404(db, subnet_id)
    n_ips = ip_crud.count_ips(db, subnet_id=subnet_id)
    if n_ips and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"La subred tiene {n_ips} IP(s). Use ?force=true para borrarlas junto con la subred.",
        )
    subnet_crud.delete_subnet(db, subnet_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)