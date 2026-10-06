import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { ScanSummaryView } from '@/components/ScanSummaryView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ScanAcceptedResponse, ScanRangeRequest, ScanSummary } from '@/types/api'
import { QueryCard } from '@/components/QueryCard'
import { estimateDurationMs, startIpPolling } from '@/lib/scanPolling'
import { SaveScanDialog, type ScanItem } from '@/components/SaveScanDialog'

// --- Validación -------------------------------------------------------------
const isIp = (s: string) => z.union([z.ipv4(), z.ipv6()]).safeParse(s).success
const ipv4ToInt = (s: string) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0)

// Prefijo CIDR (0-128) o máscara decimal (255.255.255.0)
const isNetmask = (s: string) =>
  (/^\d{1,3}$/.test(s) && Number(s) <= 128) || z.ipv4().safeParse(s).success

const schema = z
  .object({
    mode: z.enum(['range', 'network']),
    start_ip: z.string().trim(),
    end_ip: z.string().trim(),
    address: z.string().trim(),
    netmask: z.string().trim(),
    concurrency: z.number({ error: 'Número requerido' }).int('Debe ser entero').min(1, 'Mínimo 1').max(200, 'Máximo 200'),
    timeout: z.number({ error: 'Número requerido' }).int('Debe ser entero').min(1, 'Mínimo 1').max(30, 'Máximo 30'),
    run_async: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

    if (v.mode === 'range') {
      if (!isIp(v.start_ip)) bad('start_ip', 'IP inicial no válida.')
      if (!isIp(v.end_ip)) bad('end_ip', 'IP final no válida.')
      if (z.ipv4().safeParse(v.start_ip).success && z.ipv4().safeParse(v.end_ip).success &&
          ipv4ToInt(v.end_ip) < ipv4ToInt(v.start_ip))
        bad('end_ip', 'La IP final debe ser mayor o igual a la inicial.')
    } else {
      if (!isIp(v.address)) bad('address', 'Dirección no válida.')
      if (!isNetmask(v.netmask)) bad('netmask', 'Usa un prefijo (24) o una máscara (255.255.255.0).')
    }
  })

type FormValues = z.infer<typeof schema>
type ScanResult = ScanSummary | ScanAcceptedResponse

// --- UI ---------------------------------------------------------------------
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function ScanPage() {
  const qc = useQueryClient()
  const [result, setResult] = useState<ScanResult | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'range', start_ip: '', end_ip: '', address: '', netmask: '24',
      concurrency: 30, timeout: 2, run_async: false,
    },
  })
  const mode = watch('mode')

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body: ScanRangeRequest = {
        concurrency: v.concurrency, timeout: v.timeout, run_async: v.run_async, dry_run: !v.run_async,
        ...(v.mode === 'range'
          ? { start_ip: v.start_ip, end_ip: v.end_ip }
          : { address: v.address, netmask: v.netmask }),
      }
      return api.ips.scan(body)
    },
    onSuccess: (res) => {
      setResult(res)
      setSaved(false)
      if ('details' in res) {
        toast.success(`Escaneo terminado: ${res.up} de ${res.total} IPs responden. Pulsa «Guardar estados» para registrarlo.`)
      } else {
        startIpPolling(
          qc,
          estimateDurationMs(res.total_ips, res.concurrency, res.timeout),
          res.message,
        )
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const items: ScanItem[] = result && 'details' in result
  ? result.details.map((d) => {
      const ev = d.evaluation as { previous_status?: string; new_status?: string } | null
      return { ip_address: d.ip_address, is_up: d.is_up, registered: ev !== null,
               previous: ev?.previous_status, next: ev?.new_status }
    })
  : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Escaneo y consulta</h1>

      <Card>
        <CardHeader>
          <CardTitle>Escaneo por ping</CardTitle>
          <CardDescription>
            Solo ICMP. Máximo 1024 IPs por escaneo. Para rangos grandes usa modo asíncrono.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === 'range' ? 'default' : 'outline'}
                onClick={() => setValue('mode', 'range')}>Rango de IPs</Button>
              <Button type="button" size="sm" variant={mode === 'network' ? 'default' : 'outline'}
                onClick={() => setValue('mode', 'network')}>Red (dirección + máscara)</Button>
            </div>

            {mode === 'range' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="IP inicial" error={errors.start_ip?.message}>
                  <Input placeholder="192.168.1.1" aria-invalid={!!errors.start_ip} {...register('start_ip')} />
                </Field>
                <Field label="IP final" error={errors.end_ip?.message}>
                  <Input placeholder="192.168.1.254" aria-invalid={!!errors.end_ip} {...register('end_ip')} />
                </Field>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dirección" error={errors.address?.message}>
                  <Input placeholder="192.168.1.10" aria-invalid={!!errors.address} {...register('address')} />
                </Field>
                <Field label="Máscara / prefijo" error={errors.netmask?.message}>
                  <Input placeholder="24 o 255.255.255.0" aria-invalid={!!errors.netmask} {...register('netmask')} />
                </Field>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Concurrencia (1-200)" error={errors.concurrency?.message}>
                <Input type="number" aria-invalid={!!errors.concurrency}
                  {...register('concurrency', { valueAsNumber: true })} />
              </Field>
              <Field label="Timeout por ping, s (1-30)" error={errors.timeout?.message}>
                <Input type="number" aria-invalid={!!errors.timeout}
                  {...register('timeout', { valueAsNumber: true })} />
              </Field>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register('run_async')} />
              <span>
                Ejecutar en segundo plano (asíncrono)
                <span className="block text-xs text-muted-foreground">
                  Responde de inmediato (202). Los estados se actualizan al terminar; revisa la tabla de IPs.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Escaneando...' : 'Iniciar escaneo'}
              </Button>
              <Button type="button" variant="secondary" disabled={items.length === 0 || saved}
              onClick={() => setSaveOpen(true)}>
                {saved ? 'Estados guardados' : 'Guardar estados de las IP’s escaneadas'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && ('details' in result ? (
        <ScanSummaryView summary={result} />
      ) : (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Escaneo encolado</CardTitle>
            <CardDescription>
              {result.message} {result.total_ips} IPs · concurrencia {result.concurrency} · timeout {result.timeout} s.
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
      {saveOpen && (
        <SaveScanDialog items={items} method="PING"
        onSaved={() => setSaved(true)} onClose={() => setSaveOpen(false)} />
        )}
      <QueryCard />
    </div>
  )
}