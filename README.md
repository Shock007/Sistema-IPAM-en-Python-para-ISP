# IPAM Python — Fase 1

Estructura base del backend: ORM (SQLAlchemy), migraciones (Alembic) y CRUD
manual de subredes, clientes e IPs. Compatible con **PostgreSQL** y **MySQL**
sin cambiar código, solo `DATABASE_URL`.

## Estructura

```
ipam-python/
├── app/
│   ├── config.py          # Lectura de variables de entorno
│   ├── database.py        # Engine, Session, Base declarativa
│   ├── models/             # Subnet, Client, IPAddress, IPStateHistory
│   └── crud/                # Funciones CRUD por entidad
├── alembic/                 # Migraciones
│   └── versions/0001_initial_schema.py
├── alembic.ini
├── demo_crud.py            # Script de prueba manual
├── requirements.txt
└── .env.example
```

## Modelo de datos

- **Subnet**: `cidr` (único), `name`, `description`, `vlan_id`.
- **Client**: `full_name`, `document_id` (único), `email`, `phone`, `address`,
  `wisphub_client_id` (para la integración de la Fase 2), `is_active`.
- **IPAddress**: `ip_address` (único), `subnet_id` (FK), `client_id` (FK
  nullable), `status` (`FREE` / `ASSIGNED` / `ACTIVE`), `description`.
- **IPStateHistory**: bitácora de cambios de estado (`method`: `PING`, `TCP`,
  `WISPHUB`, `MANUAL`) — se llenará en la Fase 2 con el motor de escaneo.

## Puesta en marcha

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # editar DATABASE_URL (Postgres o MySQL)

alembic upgrade head    # crea las tablas

python demo_crud.py     # prueba manual del CRUD
```

## Cambiar de motor de BD

Solo se edita `DATABASE_URL` en `.env`:

- PostgreSQL: `postgresql+psycopg2://user:pass@host:5432/db`
- MySQL: `mysql+pymysql://user:pass@host:3306/db`

## Siguiente fase

Fase 2 usará `IPStateHistory` y el campo `wisphub_client_id` de `Client` para
el motor de verificación (ping, sockets TCP, adaptador WispHub).
