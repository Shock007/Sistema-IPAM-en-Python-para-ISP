import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SubnetFormDialog } from '@/components/SubnetFormDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SubnetRead } from '@/types/api'

export function SubnetsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ subnet?: SubnetRead } | null>(null) // null = cerrado
  const [deleting, setDeleting] = useState<SubnetRead | null>(null)

  const subnets = useQuery({
    queryKey: ['subnets', 'all'], // misma clave que la página de IPs
    queryFn: () => api.subnets.list({ limit: 500 }),
  })
  const stats = useQuery({ queryKey: ['ips', 'stats'], queryFn: () => api.ips.stats() })

  const ipCount = new Map(stats.data?.by_subnet.map((s) => [s.subnet_id, s.total]))
  const countOf = (id: number) => ipCount.get(id) ?? 0

  const remove = useMutation({
    mutationFn: (s: SubnetRead) => api.subnets.remove(s.id, countOf(s.id) > 0),
    onSuccess: (_, s) => {
      toast.success(`Subred ${s.cidr} eliminada.`)
      qc.invalidateQueries({ queryKey: ['subnets'] })
      qc.invalidateQueries({ queryKey: ['ips'] }) // borrado en cascada de IPs
      setDeleting(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const list = [...(subnets.data ?? [])].sort((a, b) => a.cidr.localeCompare(b.cidr))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Subredes</h1>
        <Button onClick={() => setForm({})}><Plus /> Nueva subred</Button>
      </div>

      {subnets.isError && <p className="text-sm text-destructive">{errorMessage(subnets.error)}</p>}

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CIDR</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>VLAN</TableHead>
              <TableHead>IPs</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subnets.isPending && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">Cargando...</TableCell></TableRow>
            )}
            {subnets.isSuccess && list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">No hay subredes. Crea la primera.</TableCell></TableRow>
            )}
            {list.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.cidr}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.vlan_id ?? '—'}</TableCell>
                <TableCell>{stats.isSuccess ? countOf(s.id) : '…'}</TableCell>
                <TableCell className="max-w-64 truncate" title={s.description ?? ''}>{s.description ?? '—'}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="xs" onClick={() => setForm({ subnet: s })}>Editar</Button>
                  <Button variant="destructive" size="xs" onClick={() => setDeleting(s)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {form && (
        <SubnetFormDialog key={form.subnet?.id ?? 'new'} subnet={form.subnet} onClose={() => setForm(null)} />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Eliminar ${deleting.cidr}`}
          confirmLabel={countOf(deleting.id) > 0 ? 'Eliminar con sus IPs' : 'Eliminar'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => setDeleting(null)}
          description={
            countOf(deleting.id) > 0 ? (
              <>
                Esta subred tiene <b>{countOf(deleting.id)} IP(s)</b>. Se borrarán junto con su
                historial. Esta acción no se puede deshacer.
              </>
            ) : (
              'La subred está vacía. Esta acción no se puede deshacer.'
            )
          }
        />
      )}
    </div>
  )
}