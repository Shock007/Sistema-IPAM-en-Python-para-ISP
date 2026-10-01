import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { SubnetRead } from '@/types/api'

const NONE = 'none' // sentinela: sin cliente

const isIpv4 = (s: string) => z.ipv4().safeParse(s).success
const toInt = (s: string) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0)

/** Solo IPv4. Devuelve null si no se puede comprobar en el cliente. */
function checkInSubnet(ip: string, cidr: string): 'ok' | 'outside' | 'reserved' | null {
  const [addr, p] = cidr.split('/')
  if (!isIpv4(ip) || !isIpv4(addr)) return null
  const prefix = Number(p)
  const size = 2 ** (32 - prefix)
  const net = Math.floor(toInt(addr) / size) * size
  const n = toInt(ip)
  if (n < net || n >= net + size) return 'outside'
  if (prefix < 31 && (n === net || n === net + size - 1)) return 'reserved'
  return 'ok'
}

const makeSchema = (subnets: SubnetRead[]) =>
  z
    .object({
      subnet_id: z.string().min(1, 'Selecciona una subred.'),
      ip_address: z.string().trim().refine(
        (s) => z.union([z.ipv4(), z.ipv6()]).safeParse(s).success,
        'Dirección IP no válida.',
      ),
      client_id: z.string(), // NONE = sin cliente
      description: z.string().max(500, 'Máximo 500 caracteres.'),
    })
    .superRefine((v, ctx) => {
      const subnet = subnets.find((s) => String(s.id) === v.subnet_id)
      if (!subnet) return
      const r = checkInSubnet(v.ip_address, subnet.cidr)
      if (r === 'outside')
        ctx.addIssue({ code: 'custom', path: ['ip_address'], message: `La IP no pertenece a ${subnet.cidr}.` })
      if (r === 'reserved')
        ctx.addIssue({ code: 'custom', path: ['ip_address'], message: 'Es la dirección de red o de broadcast.' })
    })

interface FormValues { subnet_id: string; ip_address: string; client_id: string; description: string }

interface Props {
  defaultClientId?: number // al abrir desde un cliente
  onClose: () => void
}

export function IPCreateDialog({ defaultClientId, onClose }: Props) {
  const qc = useQueryClient()

  // Mismas claves que el resto de la app: sin peticiones extra si ya están en caché.
  const subnets = useQuery({ queryKey: ['subnets', 'all'], queryFn: () => api.subnets.list({ limit: 500 }) })
  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => api.clients.list({ limit: 500 }) })

  const subnetList = subnets.data ?? []
  const clientOptions = (clients.data ?? []).filter((c) => c.is_active || c.id === defaultClientId)

  const subnetItems: Record<string, string> = {}
  subnetList.forEach((s) => { subnetItems[String(s.id)] = `${s.cidr} — ${s.name}` })
  const clientItems: Record<string, string> = { [NONE]: 'Sin cliente (queda Libre)' }
  clientOptions.forEach((c) => { clientItems[String(c.id)] = c.full_name })

  const { control, register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(subnetList)),
    defaultValues: {
      subnet_id: '',
      ip_address: '',
      client_id: defaultClientId ? String(defaultClientId) : NONE,
      description: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.ips.create({
        ip_address: v.ip_address.trim(),
        subnet_id: Number(v.subnet_id),
        client_id: v.client_id === NONE ? null : Number(v.client_id),
        description: v.description.trim() || null,
      }),
    onSuccess: (res) => {
      toast.success(
        res.client_id ? `IP ${res.ip_address} creada y asignada.` : `IP ${res.ip_address} creada (libre).`,
      )
      qc.invalidateQueries({ queryKey: ['ips'] }) // lista + stats
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>Nueva IP</DialogTitle>
            <DialogDescription>
              Ubica la dirección en una subred y, si quieres, asígnala a un cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Subred</label>
            <Controller
              control={control}
              name="subnet_id"
              render={({ field }) => (
                <Select value={field.value || null} items={subnetItems}
                  disabled={subnets.isPending || subnetList.length === 0}
                  onValueChange={(v) => field.onChange(v ?? '')}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.subnet_id}>
                    <SelectValue placeholder={subnets.isPending ? 'Cargando...' : 'Selecciona una subred'} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {subnetList.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.cidr} — {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {subnets.isSuccess && subnetList.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay subredes. Crea una primero en Subredes.</p>
            )}
            {errors.subnet_id && <p className="text-xs text-destructive">{errors.subnet_id.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Dirección IP</label>
            <Input placeholder="192.168.1.10" className="font-mono" aria-invalid={!!errors.ip_address}
              {...register('ip_address')} />
            {errors.ip_address && <p className="text-xs text-destructive">{errors.ip_address.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Cliente (opcional)</label>
            <Controller
              control={control}
              name="client_id"
              render={({ field }) => (
                <Select value={field.value} items={clientItems} onValueChange={(v) => field.onChange(v ?? NONE)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value={NONE}>{clientItems[NONE]}</SelectItem>
                    {clientOptions.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Descripción (opcional)</label>
            <textarea rows={2} placeholder="Ej. Router principal"
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending || subnetList.length === 0}>
              {mutation.isPending ? 'Guardando...' : 'Crear IP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}