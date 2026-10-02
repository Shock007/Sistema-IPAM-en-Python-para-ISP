import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const INTERVAL_MS = 5_000
const MIN_MS = 30_000
const MAX_MS = 300_000
const TOAST_ID = 'ip-polling'

let timer: ReturnType<typeof setInterval> | null = null

/** El backend no expone estado del escaneo: se estima por tiempo. */
export function estimateDurationMs(total: number, concurrency: number, timeoutS: number) {
  const est = Math.ceil(total / concurrency) * timeoutS * 1000 * 1.5 + 10_000
  return Math.min(MAX_MS, Math.max(MIN_MS, est))
}

export function stopIpPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function startIpPolling(qc: QueryClient, durationMs: number, message: string) {
  stopIpPolling() // un solo polling activo a la vez
  const end = Date.now() + durationMs
  toast.loading(`${message} Actualizando datos cada 5 s…`, { id: TOAST_ID })

  timer = setInterval(() => {
    qc.invalidateQueries({ queryKey: ['ips'] })
    if (Date.now() >= end) {
      stopIpPolling()
      toast.success('Monitoreo finalizado. Datos actualizados.', { id: TOAST_ID, duration: 4000 })
    }
  }, INTERVAL_MS)
}