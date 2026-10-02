# IP Address Management (IPAM) & Automated Network Scanner

Sistema integral de gestión de direcciones IP (IPAM), monitoreo activo y auditoría automatizada para entornos de proveedores de servicios de Internet (ISP) y redes corporativas. El sistema combina un motor ligero de verificación de red en **Python (FastAPI)**, una infraestructura estructural en **Laravel**, un panel de administración interactivo en **React (Vite + TypeScript + Tailwind CSS)** y almacenamiento persistente mediante **PostgreSQL/MySQL**.

---

## 📐 Arquitectura General del Sistema

El proyecto opera bajo un modelo híbrido optimizado para alta frecuencia de escaneo y gestión de clientes:

- **Backend API & Scanner (FastAPI):** Motor asíncrono para escaneo masivo (Ping ICMP + Probing de puertos TCP vía Sockets), comunicación directa con la API de **WispHub**, programación de auditorías periódicas (**APScheduler**) y persistencia de historial de estados.
- **Backend Estructural (Laravel):** Base de soporte administrativo e integración con módulos de gestión.
- **Frontend SPA (React + Vite):** Dashboard administrativo interactivo con estadísticas en tiempo real, mapas visuales de subredes/IPs, tablas paginadas, formularios validados e historial de cambios.
- **Base de Datos Relacional:** PostgreSQL o MySQL administrado mediante **SQLAlchemy** (u ORM equivalente) y migraciones de esquema.
- **Contenedorización:** Despliegue unificado con **Docker & Docker Compose**.

---

## 🗄️ Modelo de Datos (Data Model)

El modelo de datos refleja la jerarquía de red, la relación con los clientes del ISP y la trazabilidad histórica de cada IP:

```
+------------------+         +--------------------+         +-------------------+
|      Subnet      | 1     N |     IPAddress      | N     1 |      Client       |
+------------------+---------+--------------------+---------+-------------------+
| id (PK)          |         | id (PK)            |         | id (PK)           |
| cidr             |         | ip_address (UQ)    |         | name              |
| vlan_id          |         | subnet_id (FK)     |         | document_number   |
| name             |         | client_id (FK,Opt) |         | wisphub_id (UQ)   |
| description      |         | status             |         | phone             |
| created_at       |         | description        |         | email             |
+------------------+         | updated_at         |         +-------------------+
                             +--------------------+
                                       | 1
                                       | N
                             +--------------------+
                             |  IPStateHistory    |
                             +--------------------+
                             | id (PK)            |
                             | ip_id (FK)         |
                             | previous_status    |
                             | new_status         |
                             | scan_method        |
                             | details (JSON)     |
                             | checked_at         |
                             +--------------------+
```

### Estados de Dirección IP (`status`)
1. **`FREE` (Libre):** IP no asignada a ningún cliente y sin respuesta en escaneos recientes.
2. **`ASSIGNED` (Asignada):** IP vinculada formalmente a un cliente registrado en la base de datos o en WispHub.
3. **`ACTIVE` (Activa no registrada):** IP detectada en uso continuo mediante escaneo TCP/Ping, pero que no cuenta con un cliente asignado formalmente (alerta de uso irregular).

---

## 🛠️ Stack Tecnológico

### Backend
- **Lenguaje:** Python 3.11+
- **Framework REST:** FastAPI
- **ORM & BD:** SQLAlchemy (o Peewee), PostgreSQL / MySQL
- **Asincronía & Red:** `asyncio.open_connection` (Sockets TCP), `subprocess`/`aioping` (ICMP Ping)
- **Programador:** APScheduler (Auditorías automáticas periódicas)
- **Integraciones:** WispHub API Adapter

### Frontend
- **Framework:** React 18+ (con Vite y TypeScript)
- **Estilos & UI:** Tailwind CSS, shadcn/ui, Lucide Icons
- **Gestión de Estado y Data Fetching:** TanStack Query (React Query v5)
- **Formularios y Validación:** React Hook Form + Zod
- **Enrutamiento:** React Router DOM

---

## 📂 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/            # Endpoints REST (subnets, clients, ips, scan, scheduler)
│   │   ├── core/              # Configuraciones globales y variables de entorno
│   │   ├── db/                # Conexión ORM, base de datos y migraciones
│   │   ├── models/            # Modelos SQLAlchemy (Subnet, Client, IPAddress, IPStateHistory)
│   │   ├── schemas/           # Esquemas Pydantic para validación de entrada/salida
│   │   ├── services/          # Motor de red (Ping, TCP Sockets, WispHub Adapter, Evaluator)
│   │   └── scheduler/         # Tareas programadas con APScheduler
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/        # Modales, tablas, KPIs, badges de estado y visores
│   │   ├── hooks/             # Custom hooks y queries con TanStack Query
│   │   ├── layouts/           # Layout principal y navegación
│   │   ├── pages/             # Dashboard, Gestión de IPs, Subredes, Clientes
│   │   ├── services/          # Cliente HTTP (Axios/Fetch API) hacia /api/v1
│   │   ├── types/             # Definiciones de TypeScript para schemas
│   │   └── utils/             # Funciones auxiliares y formateadores
│   ├── package.json
│   ├── vite.config.ts         # Configuración de Vite (Proxy hacia Backend e subpath /app/)
│   └── Dockerfile
├── laravel-base/              # Estructura base de Laravel (Backend Híbrido)
├── docker-compose.yml         # Orquestador multi-contenedor
└── README.md
```

---

## 🚀 Estado de Avance del Proyecto

### ⚙️ Backend (FastAPI + Python)

#### Fase 1: Estructura de Proyecto y Base de Datos
- [x] Configuración inicial con SQLAlchemy compatible con PostgreSQL y MySQL.
- [x] Creación de modelos de datos iniciales (`Subnet`, `Client`, `IPAddress`, `IPStateHistory`).
- [x] Desarrollo de módulos CRUD para administración manual de subredes, clientes e IPs.

#### Fase 2: Motor de Verificación Ligero (Sockets TCP + Ping + WispHub)
- [x] **Módulo WispHub:** Adaptador API para consultar servicios activos por IP y mapear clientes.
- [x] **Módulo NetworkScanner (Sin Nmap):**
  - Verificación ICMP Ping de alta velocidad.
  - Sockets TCP asíncronos (`asyncio.open_connection`) direccionados a puertos estratégicos de ISP (`80`, `443`, `8291`, `22`, `53`, `8080`, `23`).
- [x] **Módulo de Evaluación:** Agregación de resultados e inserción automática de cambios en `ip_state_history`.

#### Fase 3: REST API y Escaneos Programados
- [x] Endpoints REST FastAPI:
  - `GET /api/v1/subnets`: Lista de subredes.
  - `GET /api/v1/clients`: Lista de clientes.
  - `GET /api/v1/ips`: Consulta paginada/filtrada por estado (`FREE`, `ASSIGNED`, `ACTIVE`) y subred.
  - `PUT /api/v1/ips/{ip}/assign`: Asignación manual de cliente, descripción y estado.
  - `POST /api/v1/ips/scan`: Disparo de escaneo síncrono o asíncrono (retorno `202 Accepted`).
  - `POST /api/v1/scheduler/run-now`: Ejecución manual e inmediata de auditoría completa.
- [x] Integración de **APScheduler** para ejecución programada periódica (ej. cada 6 o 12 horas).

#### Fase 4: Contenedorización y Producción
- [x] Empaquetado completo mediante `Dockerfile` y `docker-compose.yml` para sincronización con PostgreSQL/MySQL.

---

### 🎨 Frontend (React + Vite + TypeScript)

#### Fase 1: Base Estructural y Configuración
- [x] Inicialización del entorno Vite con React, TypeScript, Tailwind CSS y componentes `shadcn/ui`.
- [x] Configuración de Proxy en Vite apuntando a `localhost:8000` con `base: '/app/'`.
- [x] Mapeo de Tipos TypeScript idénticos a las esquemas Pydantic/FastAPI, configuración de TanStack Query y sistema de tokens de color por estado (`FREE` = Verde, `ASSIGNED` = Rojo/Azul, `ACTIVE` = Amarillo).

#### Fase 2: Vistas de Lectura y Dashboard
- [x] Dashboard principal con métricas globales (Métricas KPI desde `/ips/stats` y gráfica de distribución por subred).
- [x] Tabla interactiva de IPs con filtros por subred, estado, paginación real y badges coloreados.
- [x] Componente indicador del estado del Scheduler (estado actual, tiempo para la próxima ejecución).

#### Fase 3: Operaciones, Formularios y Gestiones
- [x] Modal interactivo de asignación de IPs con reglas de negocio validadas (no permite asignar cliente si la IP es `FREE`, ni cambiar manualmente si está `ACTIVE`).
- [x] Módulo de disparo de escaneo por rango de red o subred con selector de timeout, concurrencia, opción síncrona/asíncrona y visor de resumen `ScanSummary`.
- [x] Consulta individual de IP con prueba de socket TCP instantánea.
- [x] CRUD para administración de Subredes y Clientes.
- [x] Botón de acción rápida **"Ejecutar auditoría ahora"** conectado al endpoint del scheduler.

#### Fase 4: Experiencia en Tiempo Real, Alertas e Historial
- [x] Sistema de notificaciones tipo Toast al recibir estado `202 Accepted` con polling automático cada 5 segundos durante el escaneo.
- [x] Resaltado dinámico de IPs en estado `ACTIVE` sin cliente asignado y contador global de alertas no resueltas en la barra superior.
- [x] Visor de historial cronológico por IP en el modal de detalle (`IPStateHistory`).

---

## 🔌 API Endpoints Principales (`/api/v1`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/v1/subnets` | Obtener todas las subredes / CIDR registrados |
| `POST` | `/api/v1/subnets` | Crear una nueva subred |
| `GET` | `/api/v1/clients` | Listado de clientes sincronizados / registrados |
| `GET` | `/api/v1/ips` | Consulta de IPs con filtros por `subnet_id` y `status` |
| `GET` | `/api/v1/ips/stats` | Resumen de contadores globales de estado |
| `PUT` | `/api/v1/ips/{ip}/assign` | Asignar/desasignar IP a un cliente |
| `POST` | `/api/v1/ips/scan` | Disparar escaneo ICMP/TCP de un rango de IP o subred |
| `POST` | `/api/v1/scheduler/run-now` | Forzar ejecución inmediata del ciclo de auditoría |

---

## 🛠️ Instrucciones para Levantar la Aplicación y Probar Demos

### Prerrequisitos
- **Docker** y **Docker Compose** instalados (Recomendado).
- Alternativamente para desarrollo local: Python 3.11+, Node.js 18+, PostgreSQL o MySQL.

---

### Opción 1: Ejecución Completa con Docker Compose (Recomendado)

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/ipam-network-scanner.git
   cd ipam-network-scanner
   ```

2. **Configurar Variables de Entorno:**
   Crea un archivo `.env` en la raíz basándote en `.env.example`:
   ```env
   POSTGRES_DB=ipam_db
   POSTGRES_USER=ipam_user
   POSTGRES_PASSWORD=secret_password
   DATABASE_URL=postgresql://ipam_user:secret_password@db:5432/ipam_db
   WISPHUB_API_TOKEN=tu_token_opcional
   ```

3. **Desplegar Contenedores:**
   ```bash
   docker-compose up --build -d
   ```

4. **Acceso a la Aplicación:**
   - **Frontend App (React SPA):** `http://localhost:3000/app/` o `http://localhost:80/app/`
   - **API FastAPI (Documentación OpenAPI):** `http://localhost:8000/docs`
   - **API ReDoc:** `http://localhost:8000/redoc`

---

### Opción 2: Ejecución Local para Desarrollo

#### 1. Levantamiento del Backend (FastAPI)
```bash
cd backend
python -m venv venv
# En Linux/macOS:
source venv/bin/activate
# En Windows:
# venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 2. Levantamiento del Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Accede al Frontend desde el puerto indicado por Vite (habitualmente `http://localhost:5173/app/`).

---

## 🧪 Guía de Uso y Demostración Práctica

Para probar las funcionalidades principales durante una demostración:

1. **Crear una Subred Inicial:**
   - Dirígete a la pestaña **Subredes** en el Panel.
   - Agrega una subred de prueba, por ejemplo `192.168.1.0/24` o un rango controlado de tu red de pruebas.

2. **Realizar un Escaneo Síncrono / Asíncrono:**
   - Ve a la sección **Escaneo de Red**.
   - Ingresa un rango reducido (ejemplo `192.168.1.1` - `192.168.1.20`).
   - Activa el interruptor **Modo Asíncrono** y presiona **Lanzar Escaneo**.
   - Observa la alerta tipo Toast informando la recepción `202 Accepted` y el polling automático refrescando la tabla a medida que se analizan los puertos `80, 443, 8291 (MikroTik), 22 (SSH)`.

3. **Gestión de IPs Detectadas (`ACTIVE`):**
   - Las IPs que respondan a Ping/TCP pero no tengan cliente asociado cambiarán automáticamente al estado **`ACTIVE`** (Amarillo) y aparecerán resaltadas en la barra superior.
   - Haz clic en una IP en estado `ACTIVE` para abrir el modal de asignación y vincularla a un cliente registrado o asignarle una nota explicativa.

4. **Verificar Historial de Auditoría:**
   - Abre el modal de detalles de cualquier IP para consultar el timeline de cambios generados por la tabla `ip_state_history`.