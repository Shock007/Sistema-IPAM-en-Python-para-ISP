"""Router: /api/v1/clients (listado, detalle, alta, edición y baja)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.schemas import ClientCreate, ClientRead, ClientUpdate
from app.crud import client as client_crud

router = APIRouter(prefix="/api/v1/clients", tags=["clients"])


def _get_or_404(db: Session, client_id: int):
    obj = client_crud.get_client(db, client_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"El cliente id={client_id} no existe.")
    return obj


def _conflict() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, "Ya existe un cliente con ese document_id.")


@router.get("", response_model=list[ClientRead])
def list_clients(skip: int = Query(default=0, ge=0),
                 limit: int = Query(default=100, ge=1, le=500),
                 only_active: bool = Query(default=False),
                 db: Session = Depends(get_db)):
    return client_crud.list_clients(db, skip=skip, limit=limit, only_active=only_active)


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, client_id)


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    try:
        return client_crud.create_client(db, **payload.model_dump())
    except IntegrityError as exc:
        db.rollback()
        raise _conflict() from exc


@router.put("/{client_id}", response_model=ClientRead)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db)):
    _get_or_404(db, client_id)
    try:
        return client_crud.update_client(db, client_id, **payload.model_dump(exclude_unset=True))
    except IntegrityError as exc:
        db.rollback()
        raise _conflict() from exc


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    """Borrado definitivo; sus IPs pasan a FREE. Para conservar el histórico
    use PUT con is_active=false."""
    _get_or_404(db, client_id)
    client_crud.delete_client(db, client_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)