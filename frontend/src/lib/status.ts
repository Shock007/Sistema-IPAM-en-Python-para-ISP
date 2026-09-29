import type { IPStatus } from '@/types/api'

export const STATUS_LABELS: Record<IPStatus, string> = {
  FREE: 'Libre',
  ASSIGNED: 'Asignada',
  ACTIVE: 'Activa sin registrar',
}

export const STATUS_CLASSES: Record<IPStatus, string> = {
  FREE: 'bg-status-free text-status-free-foreground',
  ASSIGNED: 'bg-status-assigned text-status-assigned-foreground',
  ACTIVE: 'bg-status-active text-status-active-foreground',
}