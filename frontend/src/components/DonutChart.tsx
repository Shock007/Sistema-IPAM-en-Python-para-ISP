import { cn } from '@/lib/utils'

const R = 40
const C = 2 * Math.PI * R

const SEGMENTS = [
  { key: 'free', color: 'var(--status-free)', label: 'Libre' },
  { key: 'assigned', color: 'var(--status-assigned)', label: 'Asignada' },
  { key: 'active', color: 'var(--status-active)', label: 'Activa' },
] as const

interface Props {
  free: number
  assigned: number
  active: number
  className?: string
}

export function DonutChart({ free, assigned, active, className }: Props) {
  const values = { free, assigned, active }
  const total = free + assigned + active

  // Se calcula antes del render para no mutar variables dentro del map.
  const arcs: { key: string; color: string; len: number; offset: number }[] = []
  let acc = 0
  for (const s of SEGMENTS) {
    const len = total ? (values[s.key] / total) * C : 0
    if (len > 0) arcs.push({ key: s.key, color: s.color, len, offset: acc })
    acc += len
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('size-28 shrink-0', className)}
      role="img"
      aria-label={`Libres ${free}, asignadas ${assigned}, activas ${active}`}
    >
      <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" style={{ stroke: 'var(--muted)' }} />
      {arcs.map((a) => (
        <circle
          key={a.key}
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="14"
          strokeDasharray={`${a.len} ${C - a.len}`}
          strokeDashoffset={-a.offset}
          transform="rotate(-90 50 50)"
          style={{ stroke: a.color }}
        />
      ))}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[18px] font-semibold"
      >
        {total}
      </text>
    </svg>
  )
}