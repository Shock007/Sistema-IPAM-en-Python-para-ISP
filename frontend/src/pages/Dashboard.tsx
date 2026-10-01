import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { DonutChart } from '@/components/DonutChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { STATUS_LABELS } from '@/lib/status'
import type { IPStatus } from '@/types/api'
import { SchedulerPanel } from '@/components/SchedulerPanel'

const METRICS: { key: 'total' | 'free' | 'assigned' | 'active'; label: string; dot?: string; hint?: string }[] = [
  { key: 'total', label: 'Total de IPs' },
  { key: 'free', label: STATUS_LABELS.FREE, dot: 'bg-status-free' },
  { key: 'assigned', label: STATUS_LABELS.ASSIGNED, dot: 'bg-status-assigned' },
  { key: 'active', label: STATUS_LABELS.ACTIVE, dot: 'bg-status-active', hint: 'Responden sin cliente asignado' },
]

const LEGEND: { key: 'free' | 'assigned' | 'active'; status: IPStatus; dot: string }[] = [
  { key: 'free', status: 'FREE', dot: 'bg-status-free' },
  { key: 'assigned', status: 'ASSIGNED', dot: 'bg-status-assigned' },
  { key: 'active', status: 'ACTIVE', dot: 'bg-status-active' },
]

export function Dashboard() {
  const stats = useQuery({ queryKey: ['ips', 'stats'], queryFn: () => api.ips.stats() })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <SchedulerPanel />

      {stats.isPending && <p className="text-sm text-muted-foreground">Cargando métricas...</p>}
      {stats.isError && <p className="text-sm text-destructive">{errorMessage(stats.error)}</p>}

      {stats.isSuccess && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {METRICS.map((m) => (
              <Card key={m.key} size="sm">
                <CardHeader>
                  <CardDescription className="flex items-center gap-2">
                    {m.dot && <span className={`size-2.5 rounded-full ${m.dot}`} />}
                    {m.label}
                  </CardDescription>
                  <CardTitle className="text-3xl">{stats.data[m.key]}</CardTitle>
                </CardHeader>
                {m.hint && (
                  <CardContent className="text-xs text-muted-foreground">{m.hint}</CardContent>
                )}
              </Card>
            ))}
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Distribución por subred</h2>
            {stats.data.by_subnet.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay subredes registradas.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {stats.data.by_subnet.map((s) => (
                  <Card key={s.subnet_id}>
                    <CardHeader>
                      <CardTitle>{s.cidr}</CardTitle>
                      <CardDescription>{s.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                      <DonutChart free={s.free} assigned={s.assigned} active={s.active} />
                      <ul className="space-y-1.5 text-sm">
                        {LEGEND.map((l) => (
                          <li key={l.key} className="flex items-center gap-2">
                            <span className={`size-2.5 rounded-full ${l.dot}`} />
                            <span className="text-muted-foreground">{STATUS_LABELS[l.status]}</span>
                            <b className="ml-auto pl-3">{s[l.key]}</b>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}