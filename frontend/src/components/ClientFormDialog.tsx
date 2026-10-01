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
import type { ClientRead } from '@/types/api'

const schema = z.object({
  full_name: z.string().trim().min(1, 'El nombre es obligatorio.').max(150, 'Máximo 150 caracteres.'),
  document_id: z.string().trim().max(30, 'Máximo 30 caracteres.'),
  email: z.string().trim().max(120, 'Máximo 120 caracteres.').refine(
    (v) => v === '' || z.email().safeParse(v).success,
    'Correo no válido.',
  ),
  phone: z.string().trim().max(30, 'Máximo 30 caracteres.'),
  address: z.string().trim().max(255, 'Máximo 255 caracteres.'),
  wisphub_client_id: z.string().trim().max(50, 'Máximo 50 caracteres.'),
})

type FormValues = z.infer<typeof schema>

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

interface Props {
  client?: ClientRead // sin client = crear
  onClose: () => void
}

export function ClientFormDialog({ client, onClose }: Props) {
  const qc = useQueryClient()
  const editing = !!client

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: client?.full_name ?? '',
      document_id: client?.document_id ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      address: client?.address ?? '',
      wisphub_client_id: client?.wisphub_client_id ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      client
        ? // Edición: "" vacía los textos; document_id vacío se omite (el backend no lo puede borrar).
          api.clients.update(client.id, {
            full_name: v.full_name,
            document_id: v.document_id || undefined,
            email: v.email,
            phone: v.phone,
            address: v.address,
            wisphub_client_id: v.wisphub_client_id,
          })
        : api.clients.create({
            full_name: v.full_name,
            document_id: v.document_id || null,
            email: v.email || null,
            phone: v.phone || null,
            address: v.address || null,
            wisphub_client_id: v.wisphub_client_id || null,
          }),
    onSuccess: (res) => {
      toast.success(editing ? `Cliente ${res.full_name} actualizado.` : `Cliente ${res.full_name} creado.`)
      qc.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4" autoComplete="off">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
            <DialogDescription>Titular del ISP al que se asignan IPs.</DialogDescription>
          </DialogHeader>

          <Field label="Nombre completo" error={errors.full_name?.message}>
            <Input aria-invalid={!!errors.full_name} {...register('full_name')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Documento (opcional)" error={errors.document_id?.message}
              hint={editing && client?.document_id ? 'Se puede cambiar, pero no quitar.' : undefined}>
              <Input aria-invalid={!!errors.document_id} {...register('document_id')} />
            </Field>
            <Field label="Teléfono (opcional)" error={errors.phone?.message}>
              <Input inputMode="tel" aria-invalid={!!errors.phone} {...register('phone')} />
            </Field>
          </div>

          <Field label="Correo (opcional)" error={errors.email?.message}>
            <Input type="email" aria-invalid={!!errors.email} {...register('email')} />
          </Field>

          <Field label="Dirección (opcional)" error={errors.address?.message}>
            <Input aria-invalid={!!errors.address} {...register('address')} />
          </Field>

          <Field label="ID en WispHub (opcional)" error={errors.wisphub_client_id?.message}>
            <Input aria-invalid={!!errors.wisphub_client_id} {...register('wisphub_client_id')} />
          </Field>

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