import React, { useState, useEffect } from 'react';

interface EnvConfig {
  database_url?: string;
  provider_pin?: string;
  scheduler_enabled?: boolean;
  scan_interval_hours?: number;
  scan_concurrency?: number;
  wisphub_api_key?: string;
  wisphub_base_url?: string;
}

export const EnvSettings: React.FC = () => {
  const [formData, setFormData] = useState<EnvConfig>({
    database_url: '',
    provider_pin: '',
    scheduler_enabled: true,
    scan_interval_hours: 6,
    scan_concurrency: 30,
    wisphub_api_key: '',
    wisphub_base_url: '',
  });

  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/v1/env')
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          database_url: data.database_url || '',
          provider_pin: data.provider_pin || '',
          scheduler_enabled: data.scheduler_enabled ?? true,
          scan_interval_hours: data.scan_interval_hours || 6,
          scan_concurrency: data.scan_concurrency || 30,
          wisphub_api_key: data.wisphub_api_key || '',
          wisphub_base_url: data.wisphub_base_url || '',
        });
        if (!data.database_url) {
          setWarning("Cuidado, el programa podrá escanear las IP que usted facilite pero no se guardará el registro de ello en ningún lado.");
        } else {
          setWarning(null);
        }
      })
      .catch((err) => console.error("Error al cargar configuración:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const payload = {
      database_url: formData.database_url?.trim() || null,
      provider_pin: formData.provider_pin?.trim() || null,
      scheduler_enabled: formData.scheduler_enabled,
      scan_interval_hours: Number(formData.scan_interval_hours) || null,
      scan_concurrency: Number(formData.scan_concurrency) || null,
      wisphub_api_key: formData.wisphub_api_key?.trim() || null,
      wisphub_base_url: formData.wisphub_base_url?.trim() || null,
    };

    try {
      const res = await fetch('/api/v1/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.warning) {
          setWarning(data.warning);
        } else {
          setWarning(null);
        }
        setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
      } else {
        setMessage({ type: 'error', text: 'Ocurrió un error al guardar la configuración.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Cargando configuración...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Variables del entorno</h2>

      {warning && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          ⚠️ <strong>Atención:</strong> {warning}
        </div>
      )}

      {message && (
        <div style={{ backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da', color: message.type === 'success' ? '#155724' : '#721c24', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Base de Datos */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>¿Qué base de datos usará?</h3>
          <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>URL de conexión (PostgreSQL / MySQL):</label>
          <input
            type="text"
            value={formData.database_url}
            onChange={(e) => setFormData({ ...formData, database_url: e.target.value })}
            placeholder="postgresql+psycopg2://usuario:password@localhost:5432/ipam_db"
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />
          <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>Si la dejas en blanco, la variable se guardará comentada en el archivo .env.</small>
        </div>

        {/* PIN de Seguridad */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>¿Qué PIN de seguridad usará?</h3>
          <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>PIN para escaneos de puertos TCP:</label>
          <input
            type="password"
            value={formData.provider_pin}
            onChange={(e) => setFormData({ ...formData, provider_pin: e.target.value })}
            placeholder="PIN de seguridad"
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />
        </div>

        {/* Escaneo Automático */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>¿Cómo quiere que funcione su Escaneo Automático Programado?</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ marginRight: '10px', fontSize: '14px' }}>Estado:</label>
            <select
              value={formData.scheduler_enabled ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, scheduler_enabled: e.target.value === 'true' })}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            >
              <option value="true">Encendido</option>
              <option value="false">Apagado</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ marginRight: '10px', fontSize: '14px' }}>¿En cuántas horas se ejecutará?:</label>
            <input
              type="number"
              min="1"
              value={formData.scan_interval_hours || ''}
              onChange={(e) => setFormData({ ...formData, scan_interval_hours: parseInt(e.target.value) || 0 })}
              style={{ width: '100px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            /> horas
          </div>

          <div>
            <label style={{ marginRight: '10px', fontSize: '14px' }}>¿Con qué concurrencia se ejecutará?:</label>
            <input
              type="number"
              min="1"
              max="200"
              value={formData.scan_concurrency || ''}
              onChange={(e) => setFormData({ ...formData, scan_concurrency: parseInt(e.target.value) || 0 })}
              style={{ width: '100px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            /> IPs en simultáneo
          </div>
        </div>

        {/* WispHub */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>¿Posee una API de WispHub?</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>API Key de WispHub:</label>
            <input
              type="text"
              value={formData.wisphub_api_key}
              onChange={(e) => setFormData({ ...formData, wisphub_api_key: e.target.value })}
              placeholder="WispHub API Key"
              style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>URL Base WispHub:</label>
            <input
              type="text"
              value={formData.wisphub_base_url}
              onChange={(e) => setFormData({ ...formData, wisphub_base_url: e.target.value })}
              placeholder="https://api.wisphub.net/v1"
              style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
          </div>
        </div>

        <button
          type="submit"
          style={{ backgroundColor: '#10b981', color: '#fff', fontWeight: '600', padding: '12px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          Guardar Configuración
        </button>
      </form>
    </div>
  );
};