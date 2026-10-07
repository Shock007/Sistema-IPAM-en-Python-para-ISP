async function loadEnvSettings() {
  try {
    const res = await fetch('/api/v1/env');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('env-db-url').value = data.database_url || '';
    document.getElementById('env-pin').value = data.provider_pin || '';
    
    if (data.scheduler_enabled === true) {
      document.getElementById('env-scheduler-status').value = 'true';
    } else if (data.scheduler_enabled === false) {
      document.getElementById('env-scheduler-status').value = 'false';
    } else {
      document.getElementById('env-scheduler-status').value = '';
    }

    document.getElementById('env-interval').value = data.scan_interval_hours || '';
    document.getElementById('env-concurrency').value = data.scan_concurrency || '';
    document.getElementById('env-wisphub-key').value = data.wisphub_api_key || '';
    document.getElementById('env-wisphub-url').value = data.wisphub_base_url || '';

    // Mostrar u ocultar la advertencia si la BBDD está vacía
    toggleDbWarning(!data.database_url);
  } catch (err) {
    console.error("Error al cargar configuración de entorno:", err);
  }
}

function toggleDbWarning(show) {
  const banner = document.getElementById('db-warning-banner');
  if (banner) {
    banner.style.display = show ? 'block' : 'none';
  }
}

async function saveEnvSettings(event) {
  event.preventDefault();

  const schedulerVal = document.getElementById('env-scheduler-status').value;
  const payload = {
    database_url: document.getElementById('env-db-url').value.trim() || null,
    provider_pin: document.getElementById('env-pin').value.trim() || null,
    scheduler_enabled: schedulerVal === '' ? null : (schedulerVal === 'true'),
    scan_interval_hours: parseInt(document.getElementById('env-interval').value) || null,
    scan_concurrency: parseInt(document.getElementById('env-concurrency').value) || null,
    wisphub_api_key: document.getElementById('env-wisphub-key').value.trim() || null,
    wisphub_base_url: document.getElementById('env-wisphub-url').value.trim() || null,
  };

  try {
    const res = await fetch('/api/v1/env', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok) {
      if (result.warning) {
        toggleDbWarning(true);
        alert(`Configuración guardada.\n\n⚠️ ${result.warning}`);
      } else {
        toggleDbWarning(false);
        alert("Configuración de entorno guardada exitosamente.");
      }
    } else {
      alert("Error al guardar la configuración.");
    }
  } catch (err) {
    console.error("Error al guardar:", err);
    alert("Ocurrió un error al intentar comunicar con el servidor.");
  }
}