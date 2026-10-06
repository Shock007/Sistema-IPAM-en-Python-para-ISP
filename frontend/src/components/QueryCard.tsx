import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { ApiError, errorMessage } from '@/lib/http'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { IPQueryResponse, IPStatus } from '@/types/api'
import {SaveScanDialog} from '@/components/SaveScanDialog'




const PORT_NAMES: Record<string, string> = {
  '80': 'HTTP', '443': 'HTTPS', '8291': 'MikroTik', '22': 'SSH',
  '53': 'DNS', '8080': 'HTTP alt.', '23': 'Telnet',
}

const STATUSES: IPStatus[] = ['FREE', 'ASSIGNED', 'ACTIVE']
const isStatus = (s: unknown): s is IPStatus => STATUSES.includes(s as IPStatus)

const schema = z
  .object({
    ip_address: z.string().trim().refine(
      (s) => z.union([z.ipv4(), z.ipv6()]).safeParse(s).success,
      'Dirección IP no válida.',
    ),
    use_tcp: z.boolean(),
    pin: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.use_tcp && !v.pin.trim())
      ctx.addIssue({ code: 'custom', path: ['pin'], message: 'El PIN es obligatorio para la consulta TCP.' })
  })

type FormValues = z.infer<typeof schema>

function ResultView({ r }: { r: IPQueryResponse }) {
  const ev = r.evaluation as
    { previous_status?: string; new_status?: string; method?: string } | null

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="font-mono">{r.ip_address}</span>
          <Badge className={cn('border-transparent',
            r.ping ? 'bg-status-free text-status-free-foreground' : 'bg-muted text-muted-foreground')}>
            Ping: {r.ping ? 'responde' : 'sin respuesta'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {r.tcp && (
          <div className="space-y-2">
            <p className="font-medium">Puertos TCP</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(r.tcp).map(([port, open]) => (
                <Badge key={port} className={cn('border-transparent',
                  open ? 'bg-status-free text-status-free-foreground' : 'bg-muted text-muted-foreground')}>
                  {port} {PORT_NAMES[port] ?? ''} · {open ? 'abierto' : 'cerrado'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {ev ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Estado:</span>
            {isStatus(ev.previous_status) && <StatusBadge status={ev.previous_status} />}
            {ev.previous_status !== ev.new_status ? (
              <>→ {isStatus(ev.new_status) && <StatusBadge status={ev.new_status} />}</>
            ) : (
              <span className="text-muted-foreground">sin cambio</span>
            )}
            <span className="text-muted-foreground">(método {ev.method})</span>
          </div>
        ) : (
          r.note && <p className="text-muted-foreground">{r.note}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function QueryCard() {
  const [result, setResult] = useState<IPQueryResponse | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ip_address: '', use_tcp: false, pin: '' },
  })
  const useTcp = watch('use_tcp')

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.ips.query({
        ip_address: v.ip_address,
        use_tcp: v.use_tcp,
        pin: v.use_tcp ? v.pin.trim() : null, // el PIN solo viaja si se pidió TCP
        dry_run: true
      }),
    onSuccess: (res) => {
      setResult(res); setSaved(false)
    },
    onError: (err) => {
      setResult(null)
      // 500 = PROVIDER_PIN sin configurar: el backend envía un mensaje útil.
      toast.error(err instanceof ApiError && err.status === 500 ? err.message : errorMessage(err))
    },
    onSettled: () => setValue('pin', ''), // nunca dejar el PIN en el formulario
  })
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Consulta única</CardTitle>
          <CardDescription>
            Ping a una IP. Activa TCP para revisar puertos de ISP; requiere el PIN del proveedor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4" autoComplete="off">
            <div className="grid gap-1.5 sm:max-w-xs">
              <label className="text-sm font-medium">Dirección IP</label>
              <Input placeholder="192.168.1.10" aria-invalid={!!errors.ip_address} {...register('ip_address')} />
              {errors.ip_address && <p className="text-xs text-destructive">{errors.ip_address.message}</p>}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                {...register('use_tcp', { onChange: (e) => { if (!e.target.checked) setValue('pin', '') } })}
              />
              <span>
                Incluir verificación TCP
                <span className="block text-xs text-muted-foreground">
                  Puertos 80, 443, 8291, 22, 53, 8080 y 23.
                </span>
              </span>
            </label>

            {useTcp && (
              <div className="grid gap-1.5 sm:max-w-xs">
                <label className="text-sm font-medium">PIN del proveedor</label>
                <Input type="password" autoComplete="new-password" aria-invalid={!!errors.pin}
                  {...register('pin')} />
                {errors.pin && <p className="text-xs text-destructive">{errors.pin.message}</p>}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Consultando...' : 'Consultar'}
              </Button>
              <Button type="button" variant="secondary" disabled={!result || saved}
                onClick={() => setSaveOpen(true)}>
                {saved ? 'Estado guardado' : 'Guardar estados de las IP’s escaneadas'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && <ResultView r={result} />}


      {saveOpen && result && (() => {
        const ev = result.evaluation as { previous_status?: string; new_status?: string } | null
        const up = result.ping || (result.tcp ? Object.values(result.tcp).some(Boolean) : false)
        return (
          <SaveScanDialog single method={result.tcp ? 'TCP' : 'PING'}
            items={[{ ip_address: result.ip_address, is_up: up, registered: ev !== null,
              previous: ev?.previous_status, next: ev?.new_status }]}
            onSaved={() => setSaved(true)} onClose={() => setSaveOpen(false)} />
        )
      })()}

    </>
  )
}