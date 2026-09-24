# IPAM System - Gestor de Subredes e IP Audit System

IPAM System es una solución modular en Python diseñada para la administración de direcciones IP, subredes y clientes. Incorpora un motor de verificación ligero de conectividad y una API REST moderna para automatizar la auditoría de estado de red.

---

## 🏗️ Estado del Proyecto y Avances

El desarrollo se ha estructurado en fases incrementales:

*   **Fase 1: Estructura de Proyecto y BBDD (Completada)**
    *   Configuración del proyecto en Python con **SQLAlchemy** (ORM compatible con PostgreSQL y MySQL).
    *   Diseño del modelo de datos e implementación de migraciones iniciales.
    *   Módulo CRUD completo para la administración manual de subredes, clientes e IPs.
*   **Fase 2: Motor de Verificación Ligero (Completada)**
    *   **Integración WispHub:** Adaptador API para consultar servicios activos vinculados por IP.
    *   **NetworkScanner (Sin Nmap):** 
        *   Verificación rápida vía Ping ICMP.
        *   Sockets TCP asíncronos (`asyncio.open_connection`) a puertos estratégicos ISP (`80`, `443`, `8291`, `22`, `53`, `8080`, `23`).
    *   **Módulo de Evaluación:** Agregación de resultados e inserción histórica automática en `ip_state_history`.
*   **Fase 3: API REST y Automatización (En desarrollo - Avance Actual)**
    *   **API REST con FastAPI:**
        *   `GET /api/v1/ips`: Consulta de IPs con filtros por estado (`FREE`, `ASSIGNED`, `ACTIVE`) y subred.
        *   `POST /api/v1/ips/scan`: Disparo de escaneos de rangos IP (síncronos o en segundo plano).
        *   `PUT /api/v1/ips/{ip}/assign`: Asignación de titular, descripción y estado manual.
    *   **Automatización:** Tareas programadas con **APScheduler** para ejecutar auditorías periódicas de red (configurable a 6, 12 o 24 horas).

---

## 🗄️ Modelo de Datos

```
+-------------------+          +-------------------+          +---------------------+
|      Client       |          |      Subnet       |          |      IPAddress      |
+-------------------+          +-------------------+          +---------------------+
| id (PK)           |<----+    | id (PK)           |<----+    | id (PK)             |
| name              |     |    | network           |     |    | ip_address (Unique) |
| wisphub_id        |     +----| name              |     +----| subnet_id (FK)      |
| contact_info      |          | vlan_id           |          | client_id (FK)      |
+-------------------+          +-------------------+          | status              |
                                                              | last_seen           |
                                                              +---------------------+
                                                                         |
                                                                         | 1:N
                                                                         v
                                                              +---------------------+
                                                              |  IPStateHistory     |
                                                              +---------------------+
                                                              | id (PK)             |
                                                              | ip_id (FK)          |
                                                              | status              |
                                                              | icmp_status         |
                                                              | open_ports (JSON)   |
                                                              | wisphub_status      |
                                                              | checked_at          |
                                                              +---------------------+
```

---

## 📁 Estructura del Proyecto

```text
ipam_system/
│
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── ips.py          # Endpoints API (Listar, Escanear, Asignar)
│   │       │   └── subnets.py      # Endpoints de subredes
│   │       └── router.py           # Enrutador principal de API
│   ├── core/
│   │   ├── config.py               # Configuración global y variables de entorno
│   │   └── database.py             # Conexión SQLAlchemy y gestión de sesión
│   ├── crud/                       # Lógica de operaciones sobre BBDD
│   │   ├── crud_ip.py
│   │   └── crud_subnet.py
│   ├── models/                     # Modelos SQLAlchemy (Subnet, IPAddress, Client, IPStateHistory)
│   ├── schemas/                    # Esquemas Pydantic para validación de API
│   ├── services/
│   │   ├── network_scanner.py      # Motor Asyncio + ICMP / Sockets TCP
│   │   ├── wisphub_adapter.py      # Adaptador API para WispHub
│   │   └── evaluator.py            # Consolidador de estados e inserción en historial
│   ├── tasks/
│   │   └── scheduler.py            # Configuración e integración de APScheduler
│   └── main.py                     # Punto de entrada de la aplicación FastAPI
│
├── demo.py                         # Script interactivo de demostración
├── requirements.txt                # Dependencias del proyecto
└── README.md
```

---

## 🛠️ Requisitos e Instalación

### Requisitos previos
* Python 3.9+
* PostgreSQL o MySQL (opcional en desarrollo, SQLite soportado por defecto)

### Instalación

1. **Clonar el repositorio y entrar al directorio:**
   ```bash
   git clone https://github.com/usuario/ipam-system.git
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

4. **Variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto basándote en el siguiente ejemplo:
   ```env
   DATABASE_URL=sqlite:///./ipam.db
   WISPHUB_API_KEY=tu_api_key_aqui
   WISPHUB_BASE_URL=https://api.wisphub.net/v1
   SCAN_INTERVAL_HOURS=12
   ```

---

## 🚀 Uso y Demos

### 1. Iniciar la API REST con Servidor de Desarrollo
Para ejecutar la aplicación con el programador de tareas activo:

```bash
uvicorn app.main:app --reload
```

Accede a la documentación interactiva OpenAPI/Swagger en:
* **Swagger UI:** `http://127.0.0.1:8000/docs`
* **ReDoc:** `http://127.0.0.1:8000/redoc`

#### Endpoints Principales:
* `GET /api/v1/ips?status=FREE&subnet_id=1` - Obtener lista de IPs filtrada.
* `POST /api/v1/ips/scan` - Ejecutar escaneo de red.
  ```json
  {
    "subnet_cidr": "192.168.1.0/24",
    "async_execution": true
  }
  ```
* `PUT /api/v1/ips/192.168.1.50/assign` - Asignar cliente o descripción a una IP.

---

### 2. Ejecución de Scripts de Demo

Puedes probar directamente las funciones de las distintas fases con el script interactivo `demo.py`:

```bash
python demo.py
```

#### Opciones disponibles en la Demo:
1. **Poblado Inicial y CRUD:** Crea subredes de prueba y registros de IP iniciales.
2. **Escaneo de Red Ligero (Ping + Sockets):** Lanza una auditoría inmediata sobre una subred sin pasar por la API REST.
3. **Consulta WispHub:** Prueba la integración y obtención de estado desde WispHub para una IP específica.
4. **Prueba de Endpoint /api/v1/ips/scan:** Realiza una petición simulada a la API para verificar el flujo completo con inserción en `ip_state_history`.