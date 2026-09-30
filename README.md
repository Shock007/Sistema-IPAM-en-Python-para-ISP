# 🌐 IPAM System - IP Address Management & Network Scanner

Un sistema integral de **Gestión de Direcciones IP (IPAM)** y **Escaneo de Red** diseñado para ISPs y administradores de infraestructura. El sistema permite la administración manual y automatizada de subredes, mapeo de clientes, monitoreo continuo de actividad de IP (vía Ping ICMP y sockets TCP) e integración con plataformas externas como WispHub.

---

## 🏗️ Arquitectura General

El proyecto utiliza una arquitectura de microservicios/híbrida para maximizar el rendimiento en las tareas de escaneo de red y proporcionar una interfaz moderna de gestión.

*   **Backend Principal (FastAPI / Python):** Encargado de la lógica core, motor de verificación liviano de sockets, tareas programadas (APScheduler) y endpoints API REST de alta concurrencia.
*   **Base Estructural / Paneles Adicionales (Laravel):** Integrado para la administración de usuarios y utilidades complementarias de negocio.
*   **Frontend SPA (React + Vite + TypeScript):** Dashboard e interfaz de usuario reactiva para mapas de calor IP, métricas y filtros en tiempo real.
*   **Base de Datos (PostgreSQL / MySQL):** Persistencia relacional para el historial de monitoreo, mapeo de clientes e IPs.

---

## 📊 Modelo de Datos

El modelo de datos relacional está optimizado para rastrear el ciclo de vida completo de cada dirección IP y guardar su historial de escaneos.

```
       +-------------------+
       |      Subnet       |
       +-------------------+
       | id (PK)           |
       | cidr              |
       | vlan_id           |
       | name              |
       +---------+---------+
                 |
                 | 1:N
                 v
       +-------------------+              +-------------------+
       |     IPAddress     |<------------|      Client       |
       +-------------------+  0..1:N      +-------------------+
       | id (PK)           |              | id (PK)           |
       | ip_address (UQ)   |              | name              |
       | status (ENUM)     |              | document_id       |
       | subnet_id (FK)    |              | wisphub_id        |
       | client_id (FK)    |              | phone             |
       | description       |              | email             |
       +---------+---------+              +-------------------+
                 |
                 | 1:N
                 v
       +-------------------+
       | IPStateHistory    |
       +-------------------+
       | id (PK)           |
       | ip_id (FK)        |
       | status            |
       | is_alive (BOOL)   |
       | open_ports (JSON) |
       | checked_at        |
       +-------------------+
```

### Estados de Dirección IP (`status`):
*   `FREE`: Dirección disponible sin asignación.
*   `ASSIGNED`: Dirección asignada formalmente a un cliente en el sistema.
*   `ACTIVE`: Dirección detectada con tráfico o respuesta en red (puede estar asignada o no registrada).

---

## 🚀 Funcionalidades y Avances por Módulo

### ⚙️ Backend (Python / FastAPI)

*   **Fase 1: Estructura de Proyecto y BBDD**
    *   ORM con **SQLAlchemy** compatible con PostgreSQL y MySQL.
    *   Migraciones automáticas estructuradas (Alembic).
    *   Mapeo completo CRUD para subredes, clientes e IPs.

*   **Fase 2: Motor de Verificación Ligero (Sin dependencia de Nmap)**
    *   **Módulo WispHub:** Adaptador API para consultar y sincronizar servicios activos por IP.
    *   **Módulo NetworkScanner:**
        *   Verificación ICMP Ping ultrasimplificada.
        *   Sockets TCP asíncronos con `asyncio.open_connection` sobre puertos críticos ISP: `80`, `443`, `8291` (MikroTik), `22` (SSH), `53` (DNS), `8080`, `23` (Telnet).
    *   **Evaluación e Histórico:** Inserción automática de resultados agregados en la tabla `ip_state_history`.

*   **Fase 3: API REST & Programación de Tareas**
    *   `GET /api/v1/subnets` - Listado e información de subredes.
    *   `GET /api/v1/clients` - Gestión de clientes registrados.
    *   `GET /api/v1/ips` - Filtros avanzados por estado (`FREE`, `ASSIGNED`, `ACTIVE`) y subred.
    *   `GET /api/v1/ips/stats` - Estadísticas globales para dashboards.
    *   `PUT /api/v1/ips/{ip}/assign` - Asignación/desasignación de titular, descripción y estado.
    *   `POST /api/v1/ips/scan` - Disparo de escaneos síncronos o asíncronos (`202 Accepted`).
    *   **Automatización:** Tareas periódicas programadas mediante **APScheduler** (auditorías automáticas cada 6 o 12 horas).

*   **Fase 4: Empaquetado y Contenedores**
    *   Dockerización mediante `docker-compose` integrando la app FastAPI, el worker de tareas y la base de datos PostgreSQL.

---

### 💻 Frontend (React + Vite + TypeScript)

Desarrollado como una Single Page Application (SPA) modular alojada bajo el base path `/app/`.

*   **Fase 1: Base Estructural**
    *   Configuración con **Vite**, **TypeScript**, **Tailwind CSS** y **shadcn/ui** (Lucide Icons).
    *   Configuración de Proxy en desarrollo hacia `http://localhost:8000`.
    *   Gestión de estado y caché mediante **TanStack Query (React Query)** para refresco automático tras escaneos asíncronos.
    *   Manejo y validación de formularios con **React Hook Form** + **Zod**.

*   **Fase 2: Visualización y Lectura**
    *   **Dashboard:** Tarjetas de métricas globales extraídas desde `/api/v1/ips/stats` y gráficas de distribución de uso por subred.
    *   **Tabla/Grid de IPs:** Grid interactivo con código de colores (*Verde = Libre*, *Rojo = Asignada*, *Amarillo = Activa no registrada*), filtros en tiempo real, badges de estado y paginación del servidor.

---

## 🛠️ Requisitos e Instalación

### Prerrequisitos
*   [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/)
*   [Node.js](https://nodejs.org/) v18+ (para desarrollo local de Frontend)
*   [Python](https://www.python.org/) 3.11+ (para desarrollo local de Backend)

---

## 🐳 Ejecución con Docker (Modo Recomendado)

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/ipam-system.git
   cd ipam-system
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de ejemplo y ajusta las credenciales:
   ```bash
   cp .env.example .env
   ```

3. **Desplegar con Docker Compose:**
   ```bash
   docker-compose up -d --build
   ```

4. **Acceso a los servicios:**
   * **Frontend SPA:** `http://localhost:8000/app/` (o puerto expuesto)
   * **API REST Docs (Swagger):** `http://localhost:8000/docs`
   * **API REST Docs (ReDoc):** `http://localhost:8000/redoc`

---

## 🧪 Ejecución y Desarrollo de Demos Locales

### 1. Servidor Backend (FastAPI)

```bash
# Acceder al directorio backend
cd backend

# Crear y activar entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar migraciones de BD
alembic upgrade head

# Iniciar servidor en modo desarrollo
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Cliente Frontend (React + Vite)

```bash
# Acceder al directorio frontend
cd frontend

# Instalar dependencias de Node
npm install

# Iniciar servidor de desarrollo Vite
npm run dev
```

El servidor local de Vite abrirá la aplicación normalmente en `http://localhost:5173/` redirigiendo las peticiones API (`/api/v1`) al backend en `localhost:8000`.

---

## 📁 Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── api/          # Endpoints REST (FastAPI)
│   │   ├── core/         # Configuraciones globales y variables de entorno
│   │   ├── db/           # Modelos ORM (SQLAlchemy) y sesión
│   │   ├── models/       # Esquemas Pydantic y modelos DB
│   │   ├── services/     # Scanner TCP/Ping, Adaptador WispHub, Scheduler
│   │   └── main.py       # Punto de entrada de la aplicación
│   ├── alembic/          # Migraciones de base de datos
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components (shadcn, tablas, cards, badges)
│   │   ├── hooks/        # Custom hooks y consultas TanStack Query
│   │   ├── services/     # Cliente HTTP / Axios
│   │   ├── types/        # Tipos TypeScript reflejados desde el Backend
│   │   └── App.tsx
│   ├── vite.config.ts    # Configuración de Vite y Proxy
│   └── package.json
├── docker-compose.yml
└── README.md
```