# IP AM & Network Scanner Dashboard

Sistema de Administración de Direcciones IP (IPAM) y Motor de Escaneo Ligero con soporte para sincronización con **WispHub**, panel interactivo y automatización de auditorías de red.

---

## 📌 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Arquitectura de Datos (Modelo de Datos)](#-arquitectura-de-datos-modelo-de-datos)
- [Estado Actual del Proyecto](#-estado-actual-del-proyecto)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Endpoints Principales de la API REST](#-endpoints-principales-de-la-api-rest)
- [Instrucciones de Uso y Demos](#-instrucciones-de-uso-y-demos)
  - [Requisitos Previos](#requisitos-previos)
  - [Ejecución con Docker Compose (Recomendado)](#ejecución-con-docker-compose-recomendado)
  - [Ejecución Manual Local (Backend + Frontend)](#ejecución-manual-local-backend--frontend)
  - [Uso de Demos y Scripts de Escaneo](#uso-de-demos-y-scripts-de-escaneo)

---

## 🚀 Características Principales

*   **Administración IPAM:** Gestión completa de subredes, clientes e direcciones IP.
*   **Escaneo Ligero y Asíncrono:** Verificación mediante Ping ICMP y Sockets TCP asíncronos (`asyncio.open_connection`) hacia puertos estratégicos ISP (`80, 443, 8291, 22, 53, 8080, 23`).
*   **Integración WispHub:** Adaptador API para consultar servicios activos por dirección IP.
*   **Historial de Auditoría:** Inserción automática de resultados de escaneo en la base de datos (`ip_state_history`).
*   **Programación de Escaneos:** Planificación de ejecuciones periódicas mediante **APScheduler**.
*   **Dashboard Moderno:** Interfaz interactiva para visualización en tiempo real con soporte para matriz de colores (Libre, Asignada, Activa sin registrar).

---

## 📊 Arquitectura de Datos (Modelo de Datos)

El sistema utiliza un ORM (SQLAlchemy / Peewee) compatible con PostgreSQL y MySQL.

### Entidades Principales

1.  **Subnet (`subnets`)**
    *   `id`: Primary Key
    *   `cidr`: String (Ej. `192.168.1.0/24`)
    *   `vlan_id`: Integer (Opcional)
    *   `name`: String
2.  **Client (`clients`)**
    *   `id`: Primary Key
    *   `document`: String (Cédula/NIT)
    *   `wisphub_id`: String (Identificador en WispHub)
    *   `phone`: String
    *   `email`: String
3.  **IPAddress (`ip_addresses`)**
    *   `ip`: String (Primary Key / Unique)
    *   `subnet_id`: FK -> `subnets.id`
    *   `client_id`: FK -> `clients.id` (Nullable)
    *   `status`: Enum (`FREE`, `ASSIGNED`, `ACTIVE`)
    *   `description`: Text
4.  **IPStateHistory (`ip_state_history`)**
    *   `id`: Primary Key
    *   `ip`: FK -> `ip_addresses.ip`
    *   `previous_status`: Enum
    *   `new_status`: Enum
    *   `response_time_ms`: Float
    *   `open_ports`: JSON / Text
    *   `checked_at`: Timestamp

---

## 🛠️ Estado Actual del Proyecto

### Backend

*   **Fase 1: Estructura de Proyecto y BBDD**
    *   [x] Configuración del proyecto en Python con SQLAlchemy/Peewee (PostgreSQL / MySQL).
    *   [x] Migraciones iniciales y esquemas de base de datos.
    *   [x] Módulo CRUD para subredes, clientes e IPs.
*   **Fase 2: Motor de Verificación Ligero (Socket TCP + Ping + WispHub)**
    *   [x] Módulo WispHub Adapter para consulta de servicios activos.
    *   [x] Módulo `NetworkScanner` (sin dependencia de Nmap) con ICMP Ping y Sockets TCP asíncronos.
    *   [x] Módulo de evaluación e inserción en `ip_state_history`.
*   **Fase 3: Backend API y Programación de Escaneos**
    *   [x] API REST desarrollada en **FastAPI**.
    *   [x] Programación de tareas automáticas con **APScheduler** (ejecución periódica cada 6-12 horas).
*   **Fase 4: Contenedores y Servicios**
    *   [x] Arquitectura Híbrida/Estructura base (FastAPI + Laravel como soporte estructural).
    *   [x] Dockerización mediante `docker-compose`.

### Frontend

*   **Fase 1: Base Estructural**
    *   [x] Proyecto `frontend/` configurado con **Vite**, **React**, **TypeScript**, **Tailwind CSS** y **shadcn/ui**.
    *   [x] Configuración de Proxy de Vite hacia `http://localhost:8000` con `base: '/app/'`.
    *   [x] Definición de tipos TypeScript, cliente HTTP, React Query y Tokens de color de estado.
*   **Fase 2: Lectura y Métricas**
    *   [x] Dashboard principal con métricas (`/ips/stats`) y gráfica tipo dona por subred.
    *   [x] Tabla interactiva de IPs con paginación, filtros por estado y subred.
    *   [x] Panel de estado del planificador de tareas (Scheduler).
*   **Fase 3: Escritura y Operaciones**
    *   [x] Modal de asignación/desasignación con reglas de validación (Zod).
    *   [x] Disparador de escaneo por rango/red (Síncrono/Asíncrono) con visor `ScanSummary`.
    *   [x] Consulta individual de IP con prueba de puertos TCP.
    *   [x] CRUDs para Subredes y Clientes.
    *   [x] Botón de ejecución manual inmediata de auditoría (`POST /scheduler/run-now`).

---

## 📁 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── api/             # Endpoints FastAPI (/api/v1)
│   │   ├── core/            # Configuración, DB y seguridad
│   │   ├── models/          # Modelos SQLAlchemy / Peewee
│   │   ├── schemas/         # Esquemas Pydantic
│   │   ├── services/        # WispHub, NetworkScanner, Scheduler
│   │   └── main.py          # Punto de entrada FastAPI
│   ├── migrations/          # Archivos de migración de BBDD
│   ├── requirements.txt     # Dependencias Python
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes UI (shadcn/ui, Modales, Tablas)
│   │   ├── hooks/           # Custom Hooks y TanStack Query
│   │   ├── services/        # API Client
│   │   ├── types/           # Definiciones TypeScript
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🔌 Endpoints Principales de la API REST (`/api/v1`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/subnets` | Listar subredes registradas. |
| `GET` | `/api/v1/clients` | Listar clientes registrados. |
| `GET` | `/api/v1/ips` | Listar IPs filtradas por estado (`FREE`, `ASSIGNED`, `ACTIVE`) y subred. |
| `GET` | `/api/v1/ips/stats` | Métricas y estadísticas generales de las IPs. |
| `PUT` | `/api/v1/ips/{ip}/assign` | Asignar/desasignar IP a un cliente. |
| `POST` | `/api/v1/ips/scan` | Disparar escaneo de rango (Síncrono o Asíncrono `202 Accepted`). |
| `POST` | `/api/v1/scheduler/run-now` | Ejecutar la auditoría programada de red inmediatamente. |

---

## 💻 Instrucciones de Uso y Demos

### Requisitos Previos

*   **Docker** y **Docker Compose** (opción recomendada).
*   O bien: **Python 3.10+**, **Node.js 18+** y servidor **PostgreSQL** / **MySQL**.

---

### Ejecución con Docker Compose (Recomendado)

1. **Clonar el repositorio y configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```

2. **Desplegar la pila de servicios:**
   ```bash
   docker-compose up -d --build
   ```

3. **Acceso a la aplicación:**
   *   **Frontend Dashboard:** `http://localhost:3000/app/` (o vía proxy reverso)
   *   **FastAPI Docs (Swagger):** `http://localhost:8000/docs`

---

### Ejecución Manual Local (Backend + Frontend)

#### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt

# Ejecutar migraciones
alembic upgrade head

# Iniciar servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
El panel estará disponible en `http://localhost:5173/app/`.

---

### Uso de Demos y Scripts de Escaneo

#### Demo 1: Probar Escaneo Síncrono desde la Terminal
Puedes probar la respuesta inmediata del motor de verificación haciendo una petición al endpoint de escaneo:

```bash
curl -X POST "http://localhost:8000/api/v1/ips/scan" \
     -H "Content-Type: application/json" \
     -d '{
           "subnet_cidr": "192.168.1.0/28",
           "async_mode": false,
           "ports": [80, 443, 8291]
         }'
```

#### Demo 2: Ejecución de Auditoría Completa Bajo Demanda
Para forzar una sincronización con WispHub y escaneo de todo el mapa de IPs:

```bash
curl -X POST "http://localhost:8000/api/v1/scheduler/run-now"
```

#### Demo 3: Asignación de IP a Cliente mediante API
```bash
curl -X PUT "http://localhost:8000/api/v1/ips/192.168.1.50/assign" \
     -H "Content-Type: application/json" \
     -d '{
           "client_id": 1,
           "status": "ASSIGNED",
           "description": "Asignación manual demo"
         }'
```