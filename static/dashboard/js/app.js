// Paso 5: filtros por subred/estado (se aplican sobre los datos ya
// cargados, sin volver a golpear la API) + auto-refresh cada 30s.

const API_BASE = ""; // mismo origen (FastAPI sirve API y dashboard juntos)

const FETCH_LIMIT = 500;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

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

const STATUS_BADGE_CLASSES = {
    FREE: "bg-success",
    ASSIGNED: "bg-danger",
    ACTIVE: "bg-warning text-dark",
};

const statusEl = document.getElementById("status");
const gridContainer = document.getElementById("ips-grid-container");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshBtn = document.getElementById("refresh-btn");
const filterSubnetEl = document.getElementById("filter-subnet");
const filterStatusEl = document.getElementById("filter-status");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const autoRefreshToggle = document.getElementById("auto-refresh-toggle");

// Modal de detalle (Paso 4)
const ipDetailModalEl = document.getElementById("ipDetailModal");
const ipDetailModal = new bootstrap.Modal(ipDetailModalEl);
const modalIp = document.getElementById("modal-ip");
const modalStatusBadge = document.getElementById("modal-status-badge");
const modalSubnet = document.getElementById("modal-subnet");
const modalClient = document.getElementById("modal-client");
const modalDescription = document.getElementById("modal-description");

// Caché en memoria de la última respuesta de la API; los filtros trabajan
// sobre esta caché para no tener que volver a llamar al backend.
let cache = { subnets: [], ips: [], clients: [] };
let autoRefreshTimer = null;

// --- Modal de detalle -----------------------------------------------------
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

// --- Filtros ----------------------------------------------------------------
function populateSubnetFilterOptions(subnets) {
    const previousValue = filterSubnetEl.value;

    filterSubnetEl.innerHTML = '<option value="">Todas</option>';
    subnets
        .slice()
        .sort((a, b) => a.cidr.localeCompare(b.cidr))
        .forEach((subnet) => {
            const opt = document.createElement("option");
            opt.value = String(subnet.id);
            opt.textContent = `${subnet.cidr} — ${subnet.name}`;
            filterSubnetEl.appendChild(opt);
        });

    // Conserva la selección previa si la subred sigue existiendo tras el refresh.
    if ([...filterSubnetEl.options].some((o) => o.value === previousValue)) {
        filterSubnetEl.value = previousValue;
    }
}

function getFilteredIps() {
    const subnetFilter = filterSubnetEl.value; // "" = todas
    const statusFilter = filterStatusEl.value; // "" = todos

    return cache.ips.filter((ip) => {
        const matchesSubnet = !subnetFilter || String(ip.subnet_id) === subnetFilter;
        const matchesStatus = !statusFilter || ip.status === statusFilter;
        return matchesSubnet && matchesStatus;
    });
}

function applyFilters() {
    const filteredIps = getFilteredIps();
    renderGrid(cache.subnets, filteredIps, cache.clients);

    const total = cache.ips.length;
    const shown = filteredIps.length;
    const filtroActivo = filterSubnetEl.value || filterStatusEl.value;
    setStatus(
        filtroActivo
            ? `Mostrando ${shown} de ${total} IP(s) según el filtro aplicado.`
            : `Conectado a la API. ${total} IP(s) en ${cache.subnets.length} subred(es).`,
        "success"
    );
}

// --- Construcción del grid ---------------------------------------------
function buildCell(ip, subnet, clientsById) {
    const cell = document.createElement("div");
    const statusClass = STATUS_CLASSES[ip.status] || "bg-secondary";
    cell.className = `ip-cell ${statusClass}`;
    cell.textContent = ip.ip_address.split(".").pop();
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
            '<p class="text-muted text-center py-4">No hay direcciones IP que coincidan con el filtro.</p>';
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

        cache = { subnets, ips, clients };
        populateSubnetFilterOptions(subnets);
        applyFilters(); // aplica el filtro actual (si había uno) sobre los datos nuevos

        lastUpdatedEl.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        setStatus(`Error al cargar datos: ${err.message}`, "danger");
        gridContainer.innerHTML =
            '<p class="text-danger text-center py-4">No se pudo cargar el grid. Revisa la consola.</p>';
        console.error(err);
    }
}

// --- Auto-refresh -----------------------------------------------------------
function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(loadDashboard, AUTO_REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

// --- Listeners --------------------------------------------------------------
refreshBtn.addEventListener("click", loadDashboard);
filterSubnetEl.addEventListener("change", applyFilters);
filterStatusEl.addEventListener("change", applyFilters);
clearFiltersBtn.addEventListener("click", () => {
    filterSubnetEl.value = "";
    filterStatusEl.value = "";
    applyFilters();
});
autoRefreshToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
});

document.addEventListener("DOMContentLoaded", loadDashboard);