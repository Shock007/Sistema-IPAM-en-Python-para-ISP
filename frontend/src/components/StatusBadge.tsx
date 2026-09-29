import { Badge } from '@/components/ui/badge'
import { STATUS_CLASSES, STATUS_LABELS } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { IPStatus } from '@/types/api'

export function StatusBadge({ status, className }: { status: IPStatus; className?: string }) {
  return (
    <Badge className={cn('border-transparent', STATUS_CLASSES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}