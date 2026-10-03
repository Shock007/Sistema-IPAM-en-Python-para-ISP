# Sistema de Gestión, Monitoreo y Auditoría de Direcciones IP

Sistema web integral de auditoría, monitoreo y administración de direcciones IP para Proveedores de Servicios de Internet (ISP). Integra un motor ligero de verificación TCP/ICMP asíncrono, vinculación con **WispHub**, backend híbrido de alto rendimiento y una interfaz moderna en React.

---

## 📋 Tabla de Contenido

- [Visión General](#visión-general)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Modelo de Datos](#modelo-de-datos)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Stack Tecnológico](#stack-tecnológico)
- [Fases del Proyecto y Avances](#fases-del-proyecto-y-avances)
- [Guía de Inicio y Ejecución de Demos](#guía-de-inicio-y-ejecución-de-demos)
  - [Opción 1: Despliegue con Docker (Recomendado)](#opción-1-despliegue-con-docker-recomendado)
  - [Opción 2: Desarrollo Local (Backend y Frontend)](#opción-2-desarrollo-local-backend-y-frontend)
- [Endpoints API Principales](#endpoints-api-principales)
- [Contribución y Licencia](#contribución-y-licencia)

---

## 🔀 Visión General

El sistema permite automatizar la detección de inconsistencias entre el inventario de IPs y el tráfico real en la red. Clasifica el estado de cada dirección IP en:
- **`FREE` (Verde):** IP sin cliente asignado y sin respuesta de red.
- **`ASSIGNED` (Rojo):** IP registrada y asignada oficialmente a un cliente.
- **`ACTIVE` (Amarillo):** IP respondiendo a pings/puertos o detectada en WispHub pero **no registrada/asignada** formalmente en el sistema (Alerta de conflicto / IP intrusa).

---

## 📐 Arquitectura del Sistema

El sistema utiliza una arquitectura híbrida optimizada para velocidad y escalabilidad:

```
                  ┌────────────────────────────────────────┐
                  │          Cliente Web / Dashboard       │
                  │   (React + Vite + Tailwind + TS)       │
                  └───────────────────┬────────────────────┘
                                      │
                                      │ REST API / JSON
                                      ▼
                  ┌────────────────────────────────────────┐
                  │           FastAPI Backend              │
                  │  (Gestión de IPs, Scanner & Async API) │
                  └───────┬────────────────┬───────────────┘
                          │                │
            ┌─────────────┴──┐          ┌──┴────────────────────────┐
            ▼                ▼          ▼                           ▼
    ┌──────────────┐  ┌─────────────┐ ┌───────────────────┐  ┌────────────┐
    │ Motor Ping   │  │ Sockets TCP │ │ Adapter WispHub   │  │ APScheduler│
    │ (ICMP Ping)  │  │ (Asyncio)   │ │ (API Externa ISP) │  │ (Auditoría)│
    └──────────────┘  └─────────────┘ └───────────────────┘  └────────────┘
            │                │                  │                   │
            └────────────────┼──────────────────┴───────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ Base de Datos ORM            │
              │ (PostgreSQL / MySQL)         │
              └──────────────────────────────┘
```

---

## 💾 Modelo de Datos

El esquema relacional refleja la estructura del inventario de red, clientes e historial de auditoría:

```
 ┌──────────────────────┐         ┌──────────────────────┐
 │       Subnet         │         │        Client        │
 ├──────────────────────┤         ├──────────────────────┤
 │ id (PK)              │         │ id (PK)              │
 │ cidr                 │         │ name                 │
 │ vlan_id              │         │ document_id          │
 │ name                 │         │ wisphub_id           │
 │ description          │         │ phone                │
 └──────────┬───────────┘         │ email                │
            │ 1                   └──────────┬───────────┘
            │                                │ 1
            │ N                              │ N
 ┌──────────┴────────────────────────────────┴───────────┐
 │                      IPAddress                        │
 ├───────────────────────────────────────────────────────┤
 │ ip (PK)                                               │
 │ subnet_id (FK -> Subnet.id)                           │
 │ client_id (FK -> Client.id, Nullable)                 │
 │ status [FREE | ASSIGNED | ACTIVE]                     │
 │ description                                           │
 └──────────────────────────┬────────────────────────────┘
                            │ 1
                            │ N
 ┌──────────────────────────┴────────────────────────────┐
 │                   IPStateHistory                      │
 ├───────────────────────────────────────────────────────┤
 │ id (PK)                                               │
 │ ip (FK -> IPAddress.ip)                               │
 │ checked_at (Timestamp)                                │
 │ ping_responsive (Boolean)                             │
 │ open_ports (Array/JSON)                               │
 │ wisphub_active (Boolean)                              │
 │ calculated_status                                     │
 └───────────────────────────────────────────────────────┘
```

---

## 📂 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── subnets.py       # Endpoints CRUD de Subredes
│   │   │       ├── clients.py       # Endpoints CRUD de Clientes
│   │   │       ├── ips.py           # Endpoints de IPs y Escaneos
│   │   │       └── scheduler.py     # Disparador y estado de auditoría
│   │   ├── core/
│   │   │   ├── config.py            # Variables de entorno y ajustes
│   │   │   └── database.py          # Conexión ORM SQLAlchemy/Peewee
│   │   ├── models/                  # Definición de tablas y relaciones
│   │   │   ├── subnet.py
│   │   │   ├── client.py
│   │   │   ├── ip_address.py
│   │   │   └── ip_history.py
│   │   ├── scanner/                 # Motor de verificación liviano
│   │   │   ├── ping_runner.py       # Ping ICMP rápido
│   │   │   ├── socket_checker.py    # Sockets TCP asyncio
│   │   │   └── wisphub_adapter.py   # Consulta API WispHub
│   │   ├── static/
│   │   │   └── app/                 # Build de producción del Frontend SPA
│   │   └── main.py                  # Entrypoint FastAPI
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/              # Componentes UI (shadcn/ui, Modales, Grid)
│   │   ├── hooks/                   # Custom Hooks & TanStack Queries
│   │   ├── pages/                   # Vista Principal, Subredes, Clientes, Config
│   │   ├── services/                # Cliente API HTTP
│   │   ├── types/                   # Interfaces TypeScript espejo de Schemas
│   │   ├── App.tsx                  # Enrutador e integración principal
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts               # Proxy a :8000 y base /app/
│   └── tailwind.config.js
├── docker-compose.yml               # Orquestador multi-contenedor
└── README.md
```

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework Principal:** Python 3.11+ con FastAPI.
- **ORM & BD:** SQLAlchemy / Peewee con soporte PostgreSQL y MySQL.
- **Verificación de Red:** Sockets TCP asíncronos (`asyncio.open_connection`), ICMP Ping y Adapter API WispHub.
- **Automatización:** APScheduler para tareas periódicas (ej. escaneos cada 6/12 h).
- **Base Estructural Alterna:** Laravel (Mantenido como estructura base/legacy).

### Frontend
- **Framework & Build tool:** React 18 + Vite con TypeScript.
- **UI & Estilos:** Tailwind CSS + shadcn/ui + Lucide Icons.
- **Estado y Data Fetching:** TanStack Query (React Query v5).
- **Formularios y Validación:** React Hook Form + Zod.

---

## 🚀 Fases del Proyecto y Avances

### ⚙️️ Backend

#### **Fase 1: Estructura de Proyecto y BBDD**
- Configuración ORM compatible con PostgreSQL y MySQL.
- Migraciones iniciales y modelos relacionales (`Subnet`, `Client`, `IPAddress`, `IPStateHistory`).
- Módulo CRUD completo para administración de subredes, clientes e IPs.

#### **Fase 2: Motor de Verificación Ligero**
- **Adaptador WispHub:** Consulta de estado activo por IP mediante API.
- **NetworkScanner (Sin dependencia de Nmap):**
  - Verificación ICMP Ping ágil.
  - Sockets TCP asíncronos en puertos claves de ISP: `80`, `443`, `8291` (MikroTik Winbox), `22`, `53`, `8080`, `23`.
- **Módulo de Evaluación:** Agregación de hallazgos y almacenamiento en `ip_state_history`.

#### **Fase 3: API REST & Auditorías Programadas**
- Endpoints REST en `/api/v1` con soporte de filtros.
- Escaneo manual síncrono (respuesta inmediata) y asíncrono (`202 Accepted`).
- Integración de **APScheduler** para ejecuciones programadas y disparador bajo demanda (`POST /scheduler/run-now`).

#### **Fase 4: Empaquetado y Dashboard de Respaldo**
- Montaje de archivos estáticos HTML5/Bootstrap de respaldo en `/dashboard`.
- Empaquetado Docker con `docker-compose`.

---

### 🎨 Frontend

#### **Fase 1: Base Estructural**
- Proyecto `frontend/` configurado con Vite, React, TypeScript, Tailwind CSS y shadcn/ui.
- Configuración de proxy Vite hacia `http://localhost:8000` y subruta `/app/`.
- Tipos de datos en TS, cliente HTTP centralizado y contenedor principal de layouts.

#### **Fase 2: Visualización y Lectura**
- Tarjetas de métricas interactivas y gráfica de dona por subred.
- Tabla/Grid interactivo de IPs con filtrado por estado (`FREE`, `ASSIGNED`, `ACTIVE`), subred y paginación real.
- Panel del estado del programador de tareas (estado del scheduler, última y próxima ejecución).

#### **Fase 3: Operaciones y Edición**
- Modal de asignación de cliente/IP con reglas de validación en tiempo real.
- Disparador de escaneos por rango o subred completa con Zod (concurrencia, timeout, modo síncrono/asíncrono) y visualizador `ScanSummary`.
- Consulta rápida individual con prueba TCP y PIN.
- Módulos CRUD para Subredes y Clientes.
- Botón directo de ejecución instantánea de auditoría.

#### **Fase 4: Tiempo Real y Alertas**
- Notificaciones Toast ante respuestas `202 Accepted` y polling automático cada 5s durante auditorías.
- Destacado de alertas para IPs en estado `ACTIVE` sin cliente asignado y contador centralizado en el header.
- Modal de historial detallado de estados por IP.

#### **Fase 5: Build e Integración**
- Compilación del frontend SPA dentro de `backend/app/static/app/` expuesto vía `StaticFiles` con fallback a `index.html`.

---

## 💻 Guía de Inicio y Ejecución de Demos

### Opción 1: Despliegue con Docker (Recomendado)

Esta opción levanta la base de datos PostgreSQL, el backend FastAPI y la interfaz frontend servida directamente.

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/ip-management-audit.git
   cd ip-management-audit
   ```

2. **Iniciar contenedores:**
   ```bash
   docker-compose up --build -d
   ```

3. **Acceder a las aplicaciones:**
   - **Aplicación Frontend (React SPA):** [http://localhost:8000/app/](http://localhost:8000/app/)
   - **Documentación Interactiva API (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Dashboard Legacy:** [http://localhost:8000/dashboard](http://localhost:8000/dashboard)

---

### Opción 2: Desarrollo Local (Backend y Frontend)

Si deseas trabajar en desarrollo activo con Hot Reload tanto en Backend como en Frontend:

#### 1. Configurar Backend (FastAPI)

```bash
cd backend
python -m venv venv

# En Linux/macOS:
source venv/bin/activate
# En Windows:
# venv\Scripts\activate

pip install -r requirements.txt

# Configurar variables de entorno (copiar ejemplo)
cp .env.example .env

# Iniciar servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

#### 2. Configurar Frontend (React + Vite)

En una nueva terminal:

```bash
cd frontend
npm install

# Iniciar servidor de desarrollo Vite con Proxy hacia el backend
npm run dev
```

Accede a la app en desarrollo a través de: `http://localhost:5173/`

#### 3. Compilar Frontend para Producción

Para compilar el frontend y dejarlo disponible estáticamente en la ruta `/app/` del backend:

```bash
cd frontend
npm run build
```
*(El resultado se copiará en `backend/app/static/app`)*

---

## 🔌 Endpoints API Principales

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/subnets` | Lista todas las subredes / CIDRs registradas. |
| `GET` | `/api/v1/clients` | Lista todos los clientes registrados. |
| `GET` | `/api/v1/ips` | Obtiene lista de IPs filtradas por estado (`FREE`, `ASSIGNED`, `ACTIVE`) o subred. |
| `POST`| `/api/v1/ips/scan` | Dispara un escaneo manual de rango/subred (Síncrono o Asíncrono `202 Accepted`). |
| `PUT` | `/api/v1/ips/{ip}/assign` | Asigna/desasigna titular, cliente, descripción y estado a una IP. |
| `POST`| `/api/v1/scheduler/run-now` | Ejecuta la auditoría global de red inmediatamente. |
| `GET` | `/api/v1/scheduler/status` | Devuelve información sobre el estado del programador automático. |

---

## 📄 Licencia

Este proyecto está licenciado bajo la **Licencia MIT**. Puedes consultar el archivo `LICENSE` para mayores detalles.