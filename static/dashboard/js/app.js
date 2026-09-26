// Paso 3: consume /api/v1/subnets y /api/v1/ips, y arma el grid agrupado
// por subred. Los filtros (select de subred/estado) y el modal de detalle
// se activan en los Pasos 4 y 5; por ahora el click en una celda solo
// muestra un resumen con alert() a modo de verificación.

const API_BASE = ""; // mismo origen (FastAPI sirve API y dashboard juntos)

// Límite alto para traer todo en una sola llamada mientras el volumen de
// datos es pequeño. Si el proyecto crece, esto debe migrar a paginación
// real en el backend (el endpoint ya soporta skip/limit).
const FETCH_LIMIT = 500;

const STATUS_LABELS = {
    FREE: "Libre",
    ASSIGNED: "Asignada",
    ACTIVE: "Activa sin registrar",
};

const STATUS_CLASSES = {
    FREE: "ip-free",
    ASSIGNED: "ip-assigned",
    ACTIVE: "ip-active",
};

const statusEl = document.getElementById("status");
const gridContainer = document.getElementById("ips-grid-container");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshBtn = document.getElementById("refresh-btn");

function setStatus(message, variant) {
    statusEl.textContent = message;
    statusEl.className = `alert alert-${variant} py-2 px-3 small`;
}

function ipSortKey(ip) {
    // Ordena numéricamente por octetos en vez de alfabéticamente
    // (evita que "10.0.0.2" quede antes de "10.0.0.10" mal ordenado).
    return ip.ip_address
        .split(".")
        .map((octet) => octet.padStart(3, "0"))
        .join(".");
}

async function fetchJson(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
        throw new Error(`${path} -> HTTP ${res.status}`);
    }
    return res.json();
}

function buildCell(ip) {
    const cell = document.createElement("div");
    const statusClass = STATUS_CLASSES[ip.status] || "bg-secondary";
    cell.className = `ip-cell ${statusClass}`;
    cell.textContent = ip.ip_address.split(".").pop(); // último octeto, celda compacta

    const statusLabel = STATUS_LABELS[ip.status] || ip.status;
    const detalle = [
        `IP: ${ip.ip_address}`,
        `Estado: ${statusLabel}`,
        ip.client_id ? `Cliente ID: ${ip.client_id}` : "Sin cliente asignado",
        ip.description ? `Descripción: ${ip.description}` : null,
    ]
        .filter(Boolean)
        .join("\n");

    cell.title = detalle;

    // Placeholder de interacción; el Paso 4 reemplaza esto por un modal.
    cell.addEventListener("click", () => alert(detalle));

    return cell;
}

function buildSubnetBlock(subnet, ips) {
    const wrapper = document.createElement("div");
    wrapper.className = "subnet-block card";

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("div");
    title.className = "subnet-block__title d-flex justify-content-between align-items-center";
    title.innerHTML = `
        <span>${subnet.cidr} <span class="text-muted fw-normal">— ${subnet.name}</span></span>
        <span class="badge bg-light text-dark">${ips.length} IP(s)</span>
    `;

    const grid = document.createElement("div");
    grid.className = "ip-grid";

    ips.sort((a, b) => (ipSortKey(a) > ipSortKey(b) ? 1 : -1));
    ips.forEach((ip) => grid.appendChild(buildCell(ip)));

    body.appendChild(title);
    body.appendChild(grid);
    wrapper.appendChild(body);
    return wrapper;
}

function renderGrid(subnets, ips) {
    gridContainer.innerHTML = "";

    if (ips.length === 0) {
        gridContainer.innerHTML =
            '<p class="text-muted text-center py-4">No hay direcciones IP registradas.</p>';
        return;
    }

    const ipsBySubnet = new Map();
    ips.forEach((ip) => {
        if (!ipsBySubnet.has(ip.subnet_id)) {
            ipsBySubnet.set(ip.subnet_id, []);
        }
        ipsBySubnet.get(ip.subnet_id).push(ip);
    });

    const subnetsById = new Map(subnets.map((s) => [s.id, s]));

    // Subredes con IPs, ordenadas por CIDR.
    const orderedSubnetIds = [...ipsBySubnet.keys()].sort((a, b) => {
        const cidrA = subnetsById.get(a)?.cidr || "";
        const cidrB = subnetsById.get(b)?.cidr || "";
        return cidrA.localeCompare(cidrB);
    });

    orderedSubnetIds.forEach((subnetId) => {
        const subnet = subnetsById.get(subnetId) || {
            id: subnetId,
            cidr: "(subred desconocida)",
            name: "",
        };
        gridContainer.appendChild(buildSubnetBlock(subnet, ipsBySubnet.get(subnetId)));
    });
}

async function loadDashboard() {
    setStatus("Cargando datos de la API...", "secondary");
    try {
        const [subnets, ips] = await Promise.all([
            fetchJson(`/api/v1/subnets?limit=${FETCH_LIMIT}`),
            fetchJson(`/api/v1/ips?limit=${FETCH_LIMIT}`),
        ]);

        renderGrid(subnets, ips);

        setStatus(`Conectado a la API. ${ips.length} IP(s) en ${subnets.length} subred(es).`, "success");
        lastUpdatedEl.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        setStatus(`Error al cargar datos: ${err.message}`, "danger");
        gridContainer.innerHTML =
            '<p class="text-danger text-center py-4">No se pudo cargar el grid. Revisa la consola.</p>';
        console.error(err);
    }
}

refreshBtn.addEventListener("click", loadDashboard);
document.addEventListener("DOMContentLoaded", loadDashboard);