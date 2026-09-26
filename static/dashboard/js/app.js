// Paso 4: colores dinámicos (ya vienen de STATUS_CLASSES desde el Paso 3;
// aquí se refuerzan con badges en el modal) + modal de detalle en vez de
// alert(). El filtrado por subred/estado se activa en el Paso 5.

const API_BASE = ""; // mismo origen (FastAPI sirve API y dashboard juntos)

// Límite alto para traer todo en una sola llamada mientras el volumen de
// datos es pequeño. Si el proyecto crece, migrar a paginación real.
const FETCH_LIMIT = 500;

const STATUS_LABELS = {
    FREE: "Libre",
    ASSIGNED: "Asignada",
    ACTIVE: "Activa sin registrar",
};

// Clases para las celdas del grid (definidas en css/style.css).
const STATUS_CLASSES = {
    FREE: "ip-free",
    ASSIGNED: "ip-assigned",
    ACTIVE: "ip-active",
};

// Clases de Bootstrap para el badge del modal (mismos colores, distinto
// mecanismo de estilo porque el badge usa el sistema de "bg-*" de Bootstrap).
const STATUS_BADGE_CLASSES = {
    FREE: "bg-success",
    ASSIGNED: "bg-danger",
    ACTIVE: "bg-warning text-dark",
};

const statusEl = document.getElementById("status");
const gridContainer = document.getElementById("ips-grid-container");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshBtn = document.getElementById("refresh-btn");

// --- Modal de detalle -----------------------------------------------------
const ipDetailModalEl = document.getElementById("ipDetailModal");
const ipDetailModal = new bootstrap.Modal(ipDetailModalEl);
const modalIp = document.getElementById("modal-ip");
const modalStatusBadge = document.getElementById("modal-status-badge");
const modalSubnet = document.getElementById("modal-subnet");
const modalClient = document.getElementById("modal-client");
const modalDescription = document.getElementById("modal-description");

function openIpModal(ip, subnet, client) {
    modalIp.textContent = ip.ip_address;

    const statusLabel = STATUS_LABELS[ip.status] || ip.status;
    modalStatusBadge.textContent = statusLabel;
    modalStatusBadge.className = `badge ${STATUS_BADGE_CLASSES[ip.status] || "bg-secondary"}`;

    modalSubnet.textContent = subnet ? `${subnet.cidr} — ${subnet.name}` : "(subred desconocida)";
    modalClient.textContent = client ? client.full_name : "Sin cliente asignado";
    modalDescription.textContent = ip.description || "Sin descripción";

    ipDetailModal.show();
}

// --- Utilidades -------------------------------------------------------------
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

// --- Construcción del grid ---------------------------------------------
function buildCell(ip, subnet, clientsById) {
    const cell = document.createElement("div");
    const statusClass = STATUS_CLASSES[ip.status] || "bg-secondary";
    cell.className = `ip-cell ${statusClass}`;
    cell.textContent = ip.ip_address.split(".").pop(); // último octeto, celda compacta
    cell.title = `${ip.ip_address} — ${STATUS_LABELS[ip.status] || ip.status} (clic para más detalle)`;

    cell.addEventListener("click", () => {
        const client = ip.client_id ? clientsById.get(ip.client_id) : null;
        openIpModal(ip, subnet, client);
    });

    return cell;
}

function buildSubnetBlock(subnet, ips, clientsById) {
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
    ips.forEach((ip) => grid.appendChild(buildCell(ip, subnet, clientsById)));

    body.appendChild(title);
    body.appendChild(grid);
    wrapper.appendChild(body);
    return wrapper;
}

function renderGrid(subnets, ips, clients) {
    gridContainer.innerHTML = "";

    if (ips.length === 0) {
        gridContainer.innerHTML =
            '<p class="text-muted text-center py-4">No hay direcciones IP registradas.</p>';
        return;
    }

    const clientsById = new Map(clients.map((c) => [c.id, c]));
    const subnetsById = new Map(subnets.map((s) => [s.id, s]));

    const ipsBySubnet = new Map();
    ips.forEach((ip) => {
        if (!ipsBySubnet.has(ip.subnet_id)) {
            ipsBySubnet.set(ip.subnet_id, []);
        }
        ipsBySubnet.get(ip.subnet_id).push(ip);
    });

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
        gridContainer.appendChild(
            buildSubnetBlock(subnet, ipsBySubnet.get(subnetId), clientsById)
        );
    });
}

// --- Carga principal ------------------------------------------------------
async function loadDashboard() {
    setStatus("Cargando datos de la API...", "secondary");
    try {
        const [subnets, ips, clients] = await Promise.all([
            fetchJson(`/api/v1/subnets?limit=${FETCH_LIMIT}`),
            fetchJson(`/api/v1/ips?limit=${FETCH_LIMIT}`),
            fetchJson(`/api/v1/clients?limit=${FETCH_LIMIT}`),
        ]);

        renderGrid(subnets, ips, clients);

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