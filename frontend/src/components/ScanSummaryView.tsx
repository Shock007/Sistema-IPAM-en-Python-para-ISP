import { useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { IPStatus, ScanSummary } from '@/types/api'

type Filter = 'all' | 'up' | 'down' | 'unregistered'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'up', label: 'Responden' },
  { key: 'down', label: 'Sin respuesta' },
  { key: 'unregistered', label: 'No registradas' },
]

const STATUSES: IPStatus[] = ['FREE', 'ASSIGNED', 'ACTIVE']
const isStatus = (s: unknown): s is IPStatus => STATUSES.includes(s as IPStatus)

export function ScanSummaryView({ summary }: { summary: ScanSummary }) {
  const [filter, setFilter] = useState<Filter>('all')

  const metrics = [
    { label: 'Total', value: summary.total },
    { label: 'Responden', value: summary.up, dot: 'bg-status-free' },
    { label: 'Sin respuesta', value: summary.down, dot: 'bg-muted-foreground' },
    { label: 'Registradas', value: summary.registered },
    { label: 'No registradas', value: summary.unregistered, dot: 'bg-status-active' },
  ]

  const rows = summary.details.filter((d) =>
    filter === 'all' ? true
      : filter === 'up' ? d.is_up
      : filter === 'down' ? !d.is_up
      : d.evaluation === null,
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => (
          <Card key={m.label} size="sm">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                {m.dot && <span className={cn('size-2.5 rounded-full', m.dot)} />}
                {m.label}
              </CardDescription>
              <CardTitle className="text-2xl">{m.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} de {summary.details.length}
        </span>
      </div>

      <Card className="p-0">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Respuesta</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Cambio de estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sin resultados para este filtro.</TableCell></TableRow>
              )}
              {rows.map((d) => {
                const ev = d.evaluation as { previous_status?: string; new_status?: string } | null
                const changed = ev && ev.previous_status !== ev.new_status
                return (
                  <TableRow key={d.ip_address}>
                    <TableCell className="font-mono">{d.ip_address}</TableCell>
                    <TableCell>
                      <Badge className={cn('border-transparent',
                        d.is_up ? 'bg-status-free text-status-free-foreground' : 'bg-muted text-muted-foreground')}>
                        {d.is_up ? 'UP' : 'down'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ev ? 'Registrada' : <span className="text-muted-foreground">No registrada</span>}
                    </TableCell>
                    <TableCell>
                      {!ev ? '—' : !changed ? (
                        <span className="text-muted-foreground">Sin cambio</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {isStatus(ev.previous_status) ? <StatusBadge status={ev.previous_status} /> : '—'}
                          →
                          {isStatus(ev.new_status) && <StatusBadge status={ev.new_status} />}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}