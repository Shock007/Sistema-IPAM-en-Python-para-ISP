import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { STATUS_LABELS } from '@/lib/status'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/StatusBadge'
import { AssignDialog } from '@/components/AssignDialog'
import { IPCreateDialog } from '@/components/IPCreateDialog'
import { IPHistoryDialog } from '@/components/IPHistoryDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { IPAddressRead, IPStatus } from '@/types/api'

const PAGE_SIZE = 20

const STATUS_ITEMS: Record<string, string> = {
  all: 'Todos los estados',
  FREE: STATUS_LABELS.FREE,
  ASSIGNED: STATUS_LABELS.ASSIGNED,
  ACTIVE: STATUS_LABELS.ACTIVE,
}

export function IPsPage() {
  // El filtro de estado vive en la URL (?status=ACTIVE) para poder enlazarlo desde el header.
  const [sp, setSp] = useSearchParams()
  const rawStatus = sp.get('status')
  const status = rawStatus && rawStatus in STATUS_ITEMS ? rawStatus : 'all'
  const setStatus = (v: string) => setSp(v === 'all' ? {} : { status: v })

  const [subnet, setSubnet] = useState('all')
  const [page, setPage] = useState(0)
  const [target, setTarget] = useState<IPAddressRead | null>(null)
  const [historyFor, setHistoryFor] = useState<IPAddressRead | null>(null)
  const [creating, setCreating] = useState(false)

  const subnets = useQuery({
    queryKey: ['subnets', 'all'],
    queryFn: () => api.subnets.list({ limit: 500 }),
  })
  const clients = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => api.clients.list({ limit: 500 }),
  })

  const ips = useQuery({
    queryKey: ['ips', 'list', { status, subnet, page }],
    queryFn: () =>
      api.ips.list({
        status: status === 'all' ? undefined : (status as IPStatus),
        subnet_id: subnet === 'all' ? undefined : Number(subnet),
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData, // evita parpadeo al cambiar de página
  })

  const subnetItems: Record<string, string> = { all: 'Todas las subredes' }
  const subnetById = new Map<number, string>()
  subnets.data?.forEach((s) => {
    subnetItems[String(s.id)] = `${s.cidr} — ${s.name}`
    subnetById.set(s.id, s.cidr)
  })
  const clientById = new Map(clients.data?.map((c) => [c.id, c.full_name]))

  const total = ips.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const from = total === 0 ? 0 : safePage * PAGE_SIZE + 1
  const to = Math.min(total, (safePage + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Direcciones IP</h1>
        <Button onClick={() => setCreating(true)}><Plus /> Nueva IP</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          items={STATUS_ITEMS}
          onValueChange={(v) => { setStatus(v ?? 'all'); setPage(0) }}
        >
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(STATUS_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={subnet}
          items={subnetItems}
          onValueChange={(v) => { setSubnet(v ?? 'all'); setPage(0) }}
        >
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(subnetItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(status !== 'all' || subnet !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStatus('all'); setSubnet('all'); setPage(0) }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {ips.isError && <p className="text-sm text-destructive">{errorMessage(ips.error)}</p>}

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Subred</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Actualizada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ips.isPending && (
              <TableRow><TableCell colSpan={7} className="text-muted-foreground">Cargando...</TableCell></TableRow>
            )}
            {ips.isSuccess && ips.data.data.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-muted-foreground">No hay IPs con esos filtros.</TableCell></TableRow>
            )}
            {ips.data?.data.map((ip) => {
              const alert = ip.status === 'ACTIVE' && ip.client_id === null
              return (
                <TableRow
                  key={ip.id}
                  className={cn(
                    alert &&
                      'bg-status-active/10 shadow-[inset_3px_0_0_var(--status-active)] hover:bg-status-active/20',
                  )}
                >
                  <TableCell className="font-mono">
                    <span className="flex items-center gap-1.5">
                      {alert && (
                        <AlertTriangle className="size-3.5 text-status-active" aria-label="Sin registrar" />
                      )}
                      {ip.ip_address}
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={ip.status} /></TableCell>
                  <TableCell>{subnetById.get(ip.subnet_id) ?? `#${ip.subnet_id}`}</TableCell>
                  <TableCell>
                    {ip.client_id ? (clientById.get(ip.client_id) ?? `#${ip.client_id}`) : '—'}
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={ip.description ?? ''}>
                    {ip.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(ip.updated_at).toLocaleString('es-CO')}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="xs" onClick={() => setHistoryFor(ip)}>Historial</Button>
                    <Button variant="outline" size="xs" onClick={() => setTarget(ip)}>Asignar</Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Mostrando {from}–{to} de {total}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={safePage === 0 || ips.isFetching}
            onClick={() => setPage(safePage - 1)}>
            <ChevronLeft /> Anterior
          </Button>
          <span>Página {safePage + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1 || ips.isFetching}
            onClick={() => setPage(safePage + 1)}>
            Siguiente <ChevronRight />
          </Button>
        </div>
      </div>

      {target && (
        <AssignDialog
          key={target.id}
          ip={target}
          clients={clients.data ?? []}
          onClose={() => setTarget(null)}
        />
      )}
      {historyFor && (
        <IPHistoryDialog
          key={historyFor.id}
          ip={historyFor}
          clientName={historyFor.client_id ? clientById.get(historyFor.client_id) : undefined}
          subnetCidr={subnetById.get(historyFor.subnet_id)}
          onClose={() => setHistoryFor(null)}
        />
      )}
      {creating && <IPCreateDialog onClose={() => setCreating(false)} />}
    </div>
  )
}