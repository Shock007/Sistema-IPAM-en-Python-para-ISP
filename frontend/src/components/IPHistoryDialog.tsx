import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { IPAddressRead, IPStatus } from '@/types/api'

const STATUSES: IPStatus[] = ['FREE', 'ASSIGNED', 'ACTIVE']
const isStatus = (s: unknown): s is IPStatus => STATUSES.includes(s as IPStatus)

interface Props {
  ip: IPAddressRead
  clientName?: string
  subnetCidr?: string
  onClose: () => void
}

export function IPHistoryDialog({ ip, clientName, subnetCidr, onClose }: Props) {
  // Cuelga de ['ips']: el polling del escaneo también refresca el historial abierto.
  const history = useQuery({
    queryKey: ['ips', 'history', ip.ip_address],
    queryFn: () => api.ips.history(ip.ip_address, 50),
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{ip.ip_address}</span>
            <StatusBadge status={ip.status} />
          </DialogTitle>
          <DialogDescription>
            {subnetCidr ?? `Subred #${ip.subnet_id}`} · {clientName ?? 'Sin cliente'}
            {ip.description ? ` · ${ip.description}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.isPending && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">Cargando...</TableCell></TableRow>
              )}
              {history.isError && (
                <TableRow><TableCell colSpan={4} className="text-destructive">{errorMessage(history.error)}</TableCell></TableRow>
              )}
              {history.isSuccess && history.data.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sin verificaciones registradas.</TableCell></TableRow>
              )}
              {history.data?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(h.checked_at).toLocaleString('es-CO')}
                  </TableCell>
                  <TableCell><Badge variant="outline">{h.method}</Badge></TableCell>
                  <TableCell>
                    {h.previous_status === h.new_status ? (
                      <span className="flex items-center gap-1.5">
                        {isStatus(h.new_status) ? <StatusBadge status={h.new_status} /> : h.new_status}
                        <span className="text-xs text-muted-foreground">sin cambio</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {isStatus(h.previous_status) ? <StatusBadge status={h.previous_status} /> : '—'}
                        →
                        {isStatus(h.new_status) ? <StatusBadge status={h.new_status} /> : h.new_status}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground" title={h.details ?? ''}>
                    {h.details ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter showCloseButton={false}>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}