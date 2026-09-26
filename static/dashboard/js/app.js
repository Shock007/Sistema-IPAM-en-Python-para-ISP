// Paso 1: solo valida que el frontend puede llamar a la API.
// La lógica del grid se agrega en el Paso 3.
const API_BASE = ""; // mismo origen (FastAPI sirve API y dashboard juntos)

async function checkApiHealth() {
    const el = document.getElementById("status");
    try {
        const res = await fetch(`${API_BASE}/api/v1/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        el.textContent = `Conectado a la API. Estado: ${data.status}`;
        el.className = "alert alert-success";
    } catch (err) {
        el.textContent = `No se pudo conectar a la API: ${err.message}`;
        el.className = "alert alert-danger";
    }
}

document.addEventListener("DOMContentLoaded", checkApiHealth);