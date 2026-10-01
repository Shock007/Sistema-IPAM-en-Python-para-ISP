import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ClientRead } from '@/types/api'
import { IPCreateDialog } from '@/components/IPCreateDialog'

export function ClientsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ client?: ClientRead } | null>(null) // null = cerrado
  const [deleting, setDeleting] = useState<ClientRead | null>(null)
  const [onlyActive, setOnlyActive] = useState(false)
  const [ipFor, setIpFor] = useState<ClientRead | null>(null)

  const clients = useQuery({
    queryKey: ['clients', 'all'], // misma clave que IPs y AssignDialog
    queryFn: () => api.clients.list({ limit: 500 }),
  })

  const toggle = useMutation({
    mutationFn: (c: ClientRead) => api.clients.update(c.id, { is_active: !c.is_active }),
    onSuccess: (res) => {
      toast.success(`${res.full_name} ${res.is_active ? 'activado' : 'desactivado'}.`)
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: (c: ClientRead) => api.clients.remove(c.id),
    onSuccess: (_, c) => {
      toast.success(`Cliente ${c.full_name} eliminado.`)
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['ips'] }) // sus IPs pasaron a FREE
      setDeleting(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const list = (clients.data ?? [])
    .filter((c) => !onlyActive || c.is_active)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button onClick={() => setForm({})}><Plus /> Nuevo cliente</Button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
        Mostrar solo activos
      </label>

      {clients.isError && <p className="text-sm text-destructive">{errorMessage(clients.error)}</p>}

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>WispHub</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.isPending && (
              <TableRow><TableCell colSpan={7} className="text-muted-foreground">Cargando...</TableCell></TableRow>
            )}
            {clients.isSuccess && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  {onlyActive ? 'No hay clientes activos.' : 'No hay clientes. Crea el primero.'}
                </TableCell>
              </TableRow>
            )}
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.full_name}</TableCell>
                <TableCell>{c.document_id ?? '—'}</TableCell>
                <TableCell>{c.email || '—'}</TableCell>
                <TableCell>{c.phone || '—'}</TableCell>
                <TableCell className="font-mono">{c.wisphub_client_id || '—'}</TableCell>
                <TableCell>
                  <Badge className={cn('border-transparent',
                    c.is_active ? 'bg-status-free text-status-free-foreground' : 'bg-muted text-muted-foreground')}>
                    {c.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="xs" disabled={!c.is_active} onClick={() => setIpFor(c)}>Asignar IP</Button>
                  <Button variant="outline" size="xs" onClick={() => setForm({ client: c })}>Editar</Button>
                  <Button variant="outline" size="xs"
                    disabled={toggle.isPending && toggle.variables?.id === c.id}
                    onClick={() => toggle.mutate(c)}>
                    {c.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button variant="destructive" size="xs" onClick={() => setDeleting(c)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {form && (
        <ClientFormDialog key={form.client?.id ?? 'new'} client={form.client} onClose={() => setForm(null)} />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Eliminar a ${deleting.full_name}`}
          confirmLabel="Eliminar definitivamente"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => setDeleting(null)}
          description={
            <>
              Las IPs asignadas a este cliente pasarán a <b>Libre</b> y perderán su titular. Esta
              acción no se puede deshacer. Para conservar el histórico, usa <b>Desactivar</b>.
            </>
          }
        />
      )}
      {ipFor && <IPCreateDialog defaultClientId={ipFor.id} onClose={() => setIpFor(null)} />}
    </div>
  )
}