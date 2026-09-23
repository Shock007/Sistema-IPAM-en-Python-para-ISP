# IPAM System (IP Address Management)

Un sistema de gestión y monitoreo de direcciones IP orientado a Proveedores de Servicios de Internet (ISPs) y redes corporativas. Permite la administración manual de subredes, clientes e IPs, el escaneo ligero de red mediante Sockets TCP/Ping, la integración con APIS externas (WispHub) y el consumo de datos mediante una API REST desarrollada en FastAPI.

---

## 🛠️ Tecnologías Utilizadas

- **Lenguaje:** Python 3.10+
- **Framework Web / API:** FastAPI + Uvicorn
- **ORM & Base de Datos:** SQLAlchemy 2.0 (compatible con PostgreSQL / MySQL / SQLite)
- **Migraciones:** Alembic
- **Redes & Concurrencia:** `asyncio`, Sockets TCP, Ping ICMP (`ping3` / `subprocess`)
- **Gestión de Entorno:** `python-dotenv`

---

## 📁 Estructura del Proyecto

```text
ipam-system/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── endpoints.py     # Endpoints de FastAPI (/ips, /scan, /assign)
│   │       └── schemas.py       # Pydantic Schemas (Request/Response)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # Configuración centralizada y Variables de Entorno
│   │   └── database.py      # Conexión y sesión de ORM (SQLAlchemy)
│   ├── crud/
│   │   ├── __init__.py
│   │   ├── crud_ip.py       # Operaciones CRUD para IPs
│   │   ├── crud_subnet.py   # Operaciones CRUD para Subredes
│   │   └── crud_client.py   # Operaciones CRUD para Clientes
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # Modelos ORM (Subnet, Client, IPAddress, IPStateHistory)
│   └── services/
│       ├── __init__.py
│       ├── scanner.py       # NetworkScanner (Ping ICMP + Sockets TCP Async)
│       ├── wisphub.py       # Adaptador API WispHub
│       └── evaluator.py     # Motor de agregación e historial (ip_state_history)
├── alembic/                 # Configuración y scripts de migraciones de BBDD
├── demos/
│   ├── demo_crud.py         # Demo script: Gestión manual CRUD
│   ├── demo_scanner.py      # Demo script: Escaneo de red y agregación
│   └── demo_wisphub.py      # Demo script: Consulta a la API WispHub
├── .env.example
├── alembic.ini
├── main.py                  # Punto de entrada principal (FastAPI App)
├── requirements.txt
└── README.md
```

---

## 📊 Modelo de Datos

El sistema maneja un esquema relacional diseñado para rastrear subredes, asignaciones a clientes, el estado actual de cada dirección IP y el historial de cambios detectados por el motor de evaluación.

```text
+-------------------+       +-------------------+
|      Subnet       |       |      Client       |
+-------------------+       +-------------------+
| id (PK)           |       | id (PK)           |
| cidr              |       | name              |
| description       |       | code / ref        |
+---------+---------+       +---------+---------+
          |                           |
          | 1                         | 1
          |                           |
          +----------+     +----------+
                     |     |
                     v     v
             +---------------+
             |   IPAddress   |
             +---------------+
             | id (PK)       |
             | ip_address    |
             | subnet_id(FK) |
             | client_id(FK) |
             | status        | --> (FREE, ASSIGNED, ACTIVE, RESERVED)
             | description   |
             | last_seen     |
             +-------+-------+
                     |
                     | 1
                     v N
            +-------------------+
            |  IPStateHistory   |
            +-------------------+
            | id (PK)           |
            | ip_address_id(FK) |
            | previous_status   |
            | new_status        |
            | source            | --> (SCANNER, WISPHUB, MANUAL)
            | details (JSON/Txt)|
            | timestamp         |
            +-------------------+
```

---

## 🚀 Fases de Desarrollo & Avances

### ✅ Fase 1: Estructura de Proyecto y Base de Datos
- **ORM & BBDD:** Configuración de SQLAlchemy con soporte para PostgreSQL, MySQL y SQLite.
- **Migraciones:** Implementación de Alembic para el control de versiones de esquema.
- **Módulo CRUD:** Funciones de administración manual para subredes, clientes y asignación de direcciones IP.

### ✅ Fase 2: Motor de Verificación Ligero
- **Módulo NetworkScanner (Sin Nmap):**
  - Verificación ICMP (Ping) rápida.
  - Sockets TCP asíncronos (`asyncio.open_connection`) orientados a puertos clave ISP (`80`, `443`, `8291` [MikroTik], `22`, `53`, `8080`, `23`).
- **Adaptador WispHub:** Integración con la API externa de WispHub para consultar servicios activos vinculados a IPs.
- **Motor de Evaluación:** Consolidación de datos de escaneo/WispHub con registro automático de cambios en `ip_state_history`.

### 🚀 Avance Fase 3: API REST (FastAPI)
Desarrollo del servicio web expuesto con las siguientes rutas:
- `GET /api/v1/ips`: Obtención de listado de IPs con filtros opcionales por estado (`FREE`, `ASSIGNED`, `ACTIVE`) y subred (`subnet_id`).
- `POST /api/v1/ips/scan`: Disparo del proceso de escaneo (síncrono o asíncrono) sobre un rango o subred.
- `PUT /api/v1/ips/{ip}/assign`: Asignación de titular/cliente, descripción y cambio de estado a una dirección IP específica.

---

## ⚙️ Instalación y Configuración

1. **Clonar el repositorio e ingresar al directorio:**
   ```bash
   git clone https://github.com/tu-usuario/ipam-system.git
   cd ipam-system
   ```

2. **Crear y activar un entorno virtual:**
   ```bash
   python -m venv venv
   # En Linux/macOS:
   source venv/bin/activate
   # En Windows:
   venv\Scripts\activate
   ```

3. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Variables de Entorno:**
   Copia el archivo `.env.example` a `.env` y ajusta las credenciales:
   ```env
   DATABASE_URL=postgresql://usuario:password@localhost:5432/ipam_db
   WISPHUB_API_KEY=tu_api_key_aqui
   WISPHUB_API_URL=https://api.wisphub.net/api/v1
   ```

5. **Ejecutar migraciones de base de datos:**
   ```bash
   alembic upgrade head
   ```

---

## 💻 Guía de Uso y Demos

### 1. Ejecución del Servidor API REST
Inicia el servidor backend interactivo:
```bash
uvicorn main:app --reload
```
Accede a la documentación interactiva Swagger UI en: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

**Ejemplos de endpoints:**
- **Listar IPs activas:** `GET /api/v1/ips?status=ACTIVE`
- **Asignar IP a Cliente:** `PUT /api/v1/ips/192.168.1.50/assign`
  ```json
  {
    "client_id": 1,
    "description": "Router Cliente Juan Pérez",
    "status": "ASSIGNED"
  }
  ```
- **Disparar Escaneo:** `POST /api/v1/ips/scan`
  ```json
  {
    "cidr": "192.168.1.0/24",
    "async_mode": true
  }
  ```

---

### 2. Demos Interactivas por Consola

Puedes probar individualmente los componentes principales usando los scripts ubicados en la carpeta `demos/`:

- **Demo CRUD (Creación de subredes, clientes y asignaciones):**
  ```bash
  python -m demos.demo_crud
  ```

- **Demo WispHub (Consulta de API externa):**
  ```bash
  python -m demos.demo_wisphub --ip 192.168.1.100
  ```

- **Demo NetworkScanner (Escaneo TCP + Ping + Agregación de Estado):**
  ```bash
  python -m demos.demo_scanner --range 192.168.1.0/28
  ```