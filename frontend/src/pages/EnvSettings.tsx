import React, { useEffect, useState } from 'react';

interface EnvConfig {
  database_url?: string;
  provider_pin?: string;
  scheduler_enabled?: boolean;
  scan_interval_hours?: number;
  scan_concurrency?: number;
  scan_timeout?: number;
  wisphub_api_key?: string;
  wisphub_base_url?: string;
}

export const EnvSettings: React.FC = () => {
  const [config, setConfig] = useState<EnvConfig>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchEnvConfig();
  }, []);

  const fetchEnvConfig = async () => {
    try {
      const res = await fetch('/api/v1/env');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (!data.database_url) {
          setWarning("Cuidado, el programa podrá escanear las IP que usted facilite pero no se guardara el registro de ello en ningún lado.");
        }
      }
    } catch (err) {
      console.error("Error al cargar variables de entorno:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch('/api/v1/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || "Configuración guardada con éxito.");
        setWarning(data.warning || (!config.database_url ? "Cuidado, el programa podrá escanear las IP que usted facilite pero no se guardara el registro de ello en ningún lado." : null));
      } else {
        alert("Error al guardar la configuración.");
      }
    } catch (err) {
      console.error("Error al actualizar:", err);
      alert("Error de conexión con el servidor backend.");
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Cargando configuración...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Variables del entorno</h1>

      {warning && (
        <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          ⚠️ <strong>Atención:</strong> {warning}
        </div>
      )}

      {message && (
        <div style={{ backgroundColor: '#d4edda', border: '1px solid #c3e6cb', color: '#155724', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          ✅ {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <fieldset style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px' }}>
          <legend style={{ fontWeight: '600', padding: '0 8px' }}>¿Qué base de datos usará?</legend>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>URL de la Base de Datos (PostgreSQL / MySQL):</label>
          <input
            type="text"
            value={config.database_url || ''}
            onChange={(e) => setConfig({ ...config, database_url: e.target.value || undefined })}
            placeholder="postgresql+psycopg2://usuario:password@localhost:5432/ipam_db"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          <small style={{ color: '#64748b' }}>Si se deja en blanco, la variable se comentará en .env.</small>
        </fieldset>

        <fieldset style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px' }}>
          <legend style={{ fontWeight: '600', padding: '0 8px' }}>¿Qué PIN de seguridad usará?</legend>
          <input
            type="password"
            value={config.provider_pin || ''}
            onChange={(e) => setConfig({ ...config, provider_pin: e.target.value || undefined })}
            placeholder="PIN de seguridad"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
        </fieldset>

        <fieldset style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px' }}>
          <legend style={{ fontWeight: '600', padding: '0 8px' }}>Escaneo Automático Programado</legend>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ marginRight: '10px' }}>Estado:</label>
            <select
              value={config.scheduler_enabled === true ? 'true' : config.scheduler_enabled === false ? 'false' : ''}
              onChange={(e) => setConfig({ ...config, scheduler_enabled: e.target.value === '' ? undefined : e.target.value === 'true' })}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="">Seleccione</option>
              <option value="true">Encendido</option>
              <option value="false">Apagado</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px' }}>Intervalo (Horas):</label>
              <input
                type="number"
                value={config.scan_interval_hours || ''}
                onChange={(e) => setConfig({ ...config, scan_interval_hours: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="6"
                style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px' }}>Concurrencia (IPs simultáneas):</label>
              <input
                type="number"
                value={config.scan_concurrency || ''}
                onChange={(e) => setConfig({ ...config, scan_concurrency: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="30"
                style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px' }}>
          <legend style={{ fontWeight: '600', padding: '0 8px' }}>Integración WispHub</legend>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>API Key WispHub:</label>
          <input
            type="text"
            value={config.wisphub_api_key || ''}
            onChange={(e) => setConfig({ ...config, wisphub_api_key: e.target.value || undefined })}
            placeholder="WispHub API Key"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '10px' }}
          />
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>URL Base WispHub:</label>
          <input
            type="text"
            value={config.wisphub_base_url || ''}
            onChange={(e) => setConfig({ ...config, wisphub_base_url: e.target.value || undefined })}
            placeholder="https://api.wisphub.net/v1"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
        </fieldset>

        <button
          type="submit"
          style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Guardar Configuración
        </button>
      </form>
    </div>
  );
};