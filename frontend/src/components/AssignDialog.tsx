import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ClientRead, IPAddressRead } from '@/types/api'

// ACTIVE no existe en el esquema: no es asignable manualmente.
const schema = z
  .object({
    status: z.enum(['FREE', 'ASSIGNED']),
    client_id: z.string(), // '' = sin cliente
    description: z.string().max(500, 'Máximo 500 caracteres'),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'ASSIGNED' && !v.client_id)
      ctx.addIssue({ code: 'custom', path: ['client_id'], message: 'Selecciona un cliente.' })
    if (v.status === 'FREE' && v.client_id)
      ctx.addIssue({ code: 'custom', path: ['client_id'], message: 'Una IP libre no admite cliente.' })
  })

type FormValues = z.infer<typeof schema>

const STATUS_ITEMS = { FREE: 'Libre', ASSIGNED: 'Asignada' }

interface Props {
  ip: IPAddressRead
  clients: ClientRead[]
  onClose: () => void
}

export function AssignDialog({ ip, clients, onClose }: Props) {
  const qc = useQueryClient()

  // Solo clientes activos (más el actual, aunque esté inactivo).
  const options = clients.filter((c) => c.is_active || c.id === ip.client_id)
  const clientItems: Record<string, string> = {}
  options.forEach((c) => { clientItems[String(c.id)] = c.full_name })

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        // Una IP ACTIVE (sin registrar) normalmente se quiere registrar → ASSIGNED.
        status: ip.status === 'FREE' ? 'FREE' : 'ASSIGNED',
        client_id: ip.client_id ? String(ip.client_id) : '',
        description: ip.description ?? '',
      },
    })

  const status = watch('status')

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.ips.assign(ip.ip_address, {
        status: v.status,
        client_id: v.status === 'ASSIGNED' ? Number(v.client_id) : null,
        description: v.description.trim(),
      }),
    onSuccess: (res) => {
      toast.success(`IP ${res.ip_address} actualizada.`)
      qc.invalidateQueries({ queryKey: ['ips'] }) // lista + stats
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{ip.ip_address}</span>
              <StatusBadge status={ip.status} />
            </DialogTitle>
            <DialogDescription>
              {ip.status === 'ACTIVE'
                ? 'Responde en la red sin cliente. Asígnala para regularizarla.'
                : 'Asigna o libera esta dirección.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Estado</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={STATUS_ITEMS}
                  onValueChange={(v) => {
                    field.onChange(v)
                    if (v === 'FREE') setValue('client_id', '') // FREE no admite cliente
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {Object.entries(STATUS_ITEMS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Cliente</label>
            <Controller
              control={control}
              name="client_id"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  items={clientItems}
                  disabled={status === 'FREE'}
                  onValueChange={(v) => field.onChange(v ?? '')}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.client_id}>
                    <SelectValue placeholder={status === 'FREE' ? 'No aplica' : 'Selecciona un cliente'} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {options.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.client_id && <p className="text-xs text-destructive">{errors.client_id.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Descripción</label>
            <textarea
              rows={3}
              placeholder="Ej. Router principal"
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              {...register('description')}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}