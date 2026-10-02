import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Play, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SchedulerStatus } from '@/types/api'
import { startIpPolling } from '@/lib/scanPolling'

interface UiState { label: string; className: string; hint?: string }

/** Interpreta los 3 booleans del backend en un único estado visible. */
function getState(s: SchedulerStatus): UiState {
  if (!s.enabled)
    return { label: 'Deshabilitado', className: 'bg-muted text-muted-foreground',
      hint: 'SCHEDULER_ENABLED=false en el servidor.' }
  if (!s.running)
    return { label: 'Detenido', className: 'bg-destructive/10 text-destructive',
      hint: 'Está habilitado pero el scheduler no está en ejecución.' }
  if (!s.job_registered)
    return { label: 'Sin tarea', className: 'bg-status-active text-status-active-foreground',
      hint: 'El scheduler corre, pero no hay auditoría registrada.' }
  return { label: 'Corriendo', className: 'bg-status-free text-status-free-foreground' }
}

function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const min = Math.round(Math.abs(diff) / 60000)
  const text = min < 1 ? 'menos de 1 min' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
  return diff >= 0 ? `en ${text}` : `hace ${text}`
}

export function SchedulerPanel() {
  const q = useQuery({
    queryKey: ['scheduler', 'status'],
    queryFn: () => api.scheduler.status(),
    refetchInterval: 30_000, // mantiene "próxima ejecución" al día
  })

    const qc = useQueryClient()
    const [cooling, setCooling] = useState(false) // evita auditorías solapadas por doble clic

    const runNow = useMutation({
      mutationFn: () => api.scheduler.runNow(),
      onSuccess: (res) => {
      startIpPolling(qc, 60_000, res.message) // auditoría completa: ventana fija de 60 s
      qc.invalidateQueries({ queryKey: ['scheduler'] })
      setCooling(true)
      setTimeout(() => setCooling(false), 10_000)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <CalendarClock className="size-4" /> Auditoría automática
        </CardDescription>
        {q.isSuccess && (
          <CardTitle className="flex items-center gap-2">
            <Badge className={cn('border-transparent', getState(q.data).className)}>
              {getState(q.data).label}
            </Badge>
          </CardTitle>
        )}
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {q.isPending && <p className="text-muted-foreground">Cargando estado...</p>}
        {q.isError && <p className="text-destructive">{errorMessage(q.error)}</p>}
        {q.isSuccess && (
          <>
            {getState(q.data).hint && (
              <p className="text-xs text-muted-foreground">{getState(q.data).hint}</p>
            )}
            <p className="flex items-center gap-2">
              <Timer className="size-4 text-muted-foreground" />
              Intervalo: <b>cada {q.data.interval_hours} h</b>
            </p>
            <p>
              Próxima ejecución:{' '}
              {q.data.next_run_time ? (
                <b title={new Date(q.data.next_run_time).toLocaleString('es-CO')}>
                  {relative(q.data.next_run_time)}
                </b>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            {q.data.next_run_time && (
              <p className="text-xs text-muted-foreground">
                {new Date(q.data.next_run_time).toLocaleString('es-CO')}
              </p>
            )}
          </>
        )}
                <div className="pt-2">
          <Button size="sm" variant="outline" disabled={runNow.isPending || cooling}
            onClick={() => runNow.mutate()}>
            <Play /> {runNow.isPending ? 'Disparando...' : cooling ? 'Auditoría en curso...' : 'Ejecutar auditoría ahora'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}