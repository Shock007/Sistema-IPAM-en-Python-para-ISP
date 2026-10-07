import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { EnvConfig, EnvUpdate } from '@/types/api'

const NO_DB =
  'Cuidado, el programa podrá escanear las IP que usted facilite pero no se guardará el registro de ello en ningún lado.'

const STATE_ITEMS = { true: 'Encendido', false: 'Apagado' }

type Mode = 'keep' | 'replace' | 'remove'

/** Secreto con 3 estados explícitos: conservar / reemplazar / quitar. */
function SecretField({ label, isSet, masked, mode, value, onMode, onValue, type = 'text', placeholder }: {
  label: string
  isSet: boolean
  masked?: string | null
  mode: Mode
  value: string
  onMode: (m: Mode) => void
  onValue: (v: string) => void
  type?: string
  placeholder?: string
}) {
  const modes: { key: Mode; label: string }[] = [
    { key: 'keep', label: 'Conservar' },
    { key: 'replace', label: 'Reemplazar' },
    { key: 'remove', label: 'Quitar' },
  ]
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        {isSet && (
          <div className="flex gap-1">
            {modes.map((m) => (
              <Button key={m.key} type="button" size="xs"
                variant={mode === m.key ? (m.key === 'remove' ? 'destructive' : 'default') : 'outline'}
                onClick={() => onMode(m.key)}>
                {m.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isSet && mode === 'keep' && (
        <p className="rounded-lg border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground">
          Configurado{masked ? `: ${masked}` : ''} · no se modificará.
        </p>
      )}
      {isSet && mode === 'remove' && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
          Se quitará al guardar (quedará comentada en .env).
        </p>
      )}
      {(!isSet || mode === 'replace') && (
        <Input type={type} autoComplete="new-password" value={value} placeholder={placeholder}
          onChange={(e) => onValue(e.target.value)} />
      )}
    </div>
  )
}

function Num({ label, value, onChange, min, max }: {
  label: string; value: string; onChange: (v: string) => void; min: number; max: number
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium">{label} ({min}-{max})</label>
      <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** El formulario se monta con la config ya cargada; `key` lo reinicia tras guardar (#15). */
function EnvForm({ cfg }: { cfg: EnvConfig }) {
  const qc = useQueryClient()
  const [restart, setRestart] = useState(false)

  const [dbMode, setDbMode] = useState<Mode>('keep'); const [db, setDb] = useState('')
  const [pinMode, setPinMode] = useState<Mode>('keep'); const [pin, setPin] = useState('')
  const [keyMode, setKeyMode] = useState<Mode>('keep'); const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(cfg.wisphub_base_url ?? '')
  const [enabled, setEnabled] = useState(cfg.scheduler_enabled)
  const [hours, setHours] = useState(String(cfg.scan_interval_hours))
  const [conc, setConc] = useState(String(cfg.scan_concurrency))
  const [timeout, setTimeoutS] = useState(String(cfg.scan_timeout))

  const mutation = useMutation({
    mutationFn: (b: EnvUpdate) => api.env.update(b),
    onSuccess: (res) => {
      toast.success(res.message)
      if (res.warning) toast.warning(res.warning)
      setRestart(res.restart_required)
      qc.setQueryData(['env'], res.current_config) // #15: remonta el formulario con lo guardado
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Valor a enviar para un secreto según su modo (#17). undefined = no tocar.
  const secret = (mode: Mode, v: string, isSet: boolean): string | undefined => {
    if (mode === 'remove') return ''
    if ((mode === 'replace' || !isSet) && v.trim()) return v.trim()
    return undefined
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body: EnvUpdate = {
      scheduler_enabled: enabled,
      scan_interval_hours: Number(hours),
      scan_concurrency: Number(conc),
      scan_timeout: Number(timeout),
      wisphub_base_url: baseUrl.trim(), // "" = quitar
      database_url: secret(dbMode, db, cfg.database_url_set),
      provider_pin: secret(pinMode, pin, cfg.provider_pin_set),
      wisphub_api_key: secret(keyMode, key, cfg.wisphub_api_key_set),
    }
    mutation.mutate(body)
  }

  const willHaveDb =
    dbMode === 'remove' ? false : cfg.database_url_set || (!!db.trim())

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-4">
      {!willHaveDb && (
        <div className="flex items-start gap-2 rounded-lg border border-status-active/50 bg-status-active/15 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-active" />
          <p><b>Atención:</b> {NO_DB}</p>
        </div>
      )}
      {restart && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted p-3 text-sm">
          <RefreshCw className="mt-0.5 size-4 shrink-0" />
          <p>Reinicia el servidor para aplicar los cambios.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>¿Qué base de datos usará?</CardTitle>
          <CardDescription>PostgreSQL o MySQL. Si la quitas, queda comentada en .env.</CardDescription>
        </CardHeader>
        <CardContent>
          <SecretField label="URL de la base de datos" isSet={cfg.database_url_set}
            masked={cfg.database_url_masked} mode={dbMode} value={db} onMode={setDbMode} onValue={setDb}
            placeholder="postgresql+psycopg2://usuario:password@localhost:5432/ipam_db" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>¿Qué PIN de seguridad usará?</CardTitle>
          <CardDescription>Protege los escaneos de puertos TCP.</CardDescription>
        </CardHeader>
        <CardContent>
          <SecretField label="PIN de seguridad" isSet={cfg.provider_pin_set} type="password"
            mode={pinMode} value={pin} onMode={setPinMode} onValue={setPin} placeholder="PIN de seguridad" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escaneo automático programado</CardTitle>
          <CardDescription>Auditoría periódica de todas las subredes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5 sm:max-w-xs">
            <label className="text-sm font-medium">Estado</label>
            <Select value={String(enabled)} items={STATE_ITEMS}
              onValueChange={(v) => setEnabled(v === 'true')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {Object.entries(STATE_ITEMS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Num label="Intervalo (horas)" value={hours} onChange={setHours} min={1} max={168} />
            <Num label="Concurrencia" value={conc} onChange={setConc} min={1} max={200} />
            <Num label="Timeout por ping (s)" value={timeout} onChange={setTimeoutS} min={1} max={30} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integración WispHub</CardTitle>
          <CardDescription>Opcional. Déjala sin configurar si no usas WispHub.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SecretField label="API Key" isSet={cfg.wisphub_api_key_set} masked={cfg.wisphub_api_key_masked}
            mode={keyMode} value={key} onMode={setKeyMode} onValue={setKey} placeholder="WispHub API Key" />
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">URL base</label>
            <Input className={cn('font-mono')} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.wisphub.net/v1" />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Guardando...' : 'Guardar configuración'}
      </Button>
    </form>
  )
}

export function EnvSettings() {
  const env = useQuery({ queryKey: ['env'], queryFn: () => api.env.get() })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Variables del entorno</h1>
      {env.isPending && <p className="text-sm text-muted-foreground">Cargando configuración...</p>}
      {env.isError && <p className="text-sm text-destructive">{errorMessage(env.error)}</p>}
      {/* key: cualquier cambio en lo guardado reinicia el estado local del formulario */}
      {env.isSuccess && <EnvForm key={JSON.stringify(env.data)} cfg={env.data} />}
    </div>
  )
}