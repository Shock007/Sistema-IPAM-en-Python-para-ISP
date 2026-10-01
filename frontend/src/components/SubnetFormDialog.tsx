import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { SubnetRead } from '@/types/api'

interface FormValues {
  cidr: string
  name: string
  description: string
  vlan_id: string // string para distinguir "vacío" de 0
}

// El CIDR solo se valida al crear: en edición es de solo lectura.
const makeSchema = (editing: boolean) =>
  z
    .object({
      cidr: z.string().trim(),
      name: z.string().trim().min(1, 'El nombre es obligatorio.').max(100, 'Máximo 100 caracteres.'),
      description: z.string().max(500, 'Máximo 500 caracteres.'),
      vlan_id: z.string().trim().refine(
        (v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 4094),
        'La VLAN debe estar entre 1 y 4094.',
      ),
    })
    .superRefine((v, ctx) => {
      if (editing) return
      const ok = z.union([z.cidrv4(), z.cidrv6()]).safeParse(v.cidr).success
      if (!ok)
        ctx.addIssue({ code: 'custom', path: ['cidr'], message: 'CIDR no válido. Ej. 192.168.1.0/24' })
    })

interface Props {
  subnet?: SubnetRead // sin subnet = crear
  onClose: () => void
}

export function SubnetFormDialog({ subnet, onClose }: Props) {
  const qc = useQueryClient()
  const editing = !!subnet

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(editing)),
    defaultValues: {
      cidr: subnet?.cidr ?? '',
      name: subnet?.name ?? '',
      description: subnet?.description ?? '',
      vlan_id: subnet?.vlan_id ? String(subnet.vlan_id) : '',
    },
  })

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const vlan = v.vlan_id.trim() ? Number(v.vlan_id) : undefined
      return subnet
        ? api.subnets.update(subnet.id, { name: v.name.trim(), description: v.description.trim(), vlan_id: vlan })
        : api.subnets.create({
            cidr: v.cidr.trim(), name: v.name.trim(),
            description: v.description.trim() || null, vlan_id: vlan ?? null,
          })
    },
    onSuccess: (res) => {
      toast.success(editing ? `Subred ${res.cidr} actualizada.` : `Subred ${res.cidr} creada.`)
      qc.invalidateQueries({ queryKey: ['subnets'] })
      qc.invalidateQueries({ queryKey: ['ips', 'stats'] }) // el dashboard lista subredes vacías
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar subred' : 'Nueva subred'}</DialogTitle>
            <DialogDescription>
              {editing ? 'El CIDR no se puede modificar.' : 'Rango de red administrado, con prefijo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">CIDR</label>
            <Input placeholder="192.168.1.0/24" readOnly={editing} className={editing ? 'bg-muted font-mono' : 'font-mono'}
              aria-invalid={!!errors.cidr} {...register('cidr')} />
            {errors.cidr && <p className="text-xs text-destructive">{errors.cidr.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <Input placeholder="Red Sector Norte" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">VLAN (opcional)</label>
            <Input inputMode="numeric" placeholder="10" aria-invalid={!!errors.vlan_id} {...register('vlan_id')} />
            {errors.vlan_id && <p className="text-xs text-destructive">{errors.vlan_id.message}</p>}
            {editing && subnet?.vlan_id && (
              <p className="text-xs text-muted-foreground">Una VLAN ya asignada se puede cambiar, pero no quitar.</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Descripción (opcional)</label>
            <textarea
              rows={3}
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