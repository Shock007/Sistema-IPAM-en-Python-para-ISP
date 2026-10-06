import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { enclosingCidr, ipInCidr } from '@/lib/net'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CheckMethod, IPStatus } from '@/types/api'

export interface ScanItem {
  ip_address: string
  is_up: boolean
  registered: boolean
  previous?: string | null
  next?: string | null
}

type Choice = 'skip' | 'register' | 'create'
const NONE = 'none'
const STATUSES: IPStatus[] = ['FREE', 'ASSIGNED', 'ACTIVE']
const isStatus = (s: unknown): s is IPStatus => STATUSES.includes(s as IPStatus)

function Opt({ checked, disabled, onSelect, children }: {
  checked: boolean; disabled?: boolean; onSelect: () => void; children: React.ReactNode
}) {
  return (
    <label className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
      <input type="radio" className="mt-1" checked={checked} disabled={disabled} onChange={onSelect} />
      <span>{children}</span>
    </label>
  )
}

interface Props {
  items: ScanItem[]
  method: CheckMethod
  single?: boolean // consulta única: permite asignar cliente
  onSaved: () => void
  onClose: () => void
}

export function SaveScanDialog({ items, method, single, onSaved, onClose }: Props) {
  const qc = useQueryClient()
  const subnets = useQuery({ queryKey: ['subnets', 'all'], queryFn: () => api.subnets.list({ limit: 500 }) })
  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => api.clients.list({ limit: 500 }) })

  const subnetList = subnets.data ?? []
  const clientList = (clients.data ?? []).filter((c) => c.is_active)

  const registered = items.filter((i) => i.registered)
  const unreg = items.filter((i) => !i.registered)
  const uncovered = unreg.filter((i) => !subnetList.some((s) => ipInCidr(i.ip_address, s.cidr)))
  const coveredCount = unreg.length - uncovered.length
  const changed = registered.filter((i) => i.previous !== i.next).length

  const suggested = enclosingCidr(uncovered.map((i) => i.ip_address)) ?? ''
  const [choice, setChoice] = useState<Choice | null>(null)
  const [cidr, setCidr] = useState<string | null>(null)
  const [name, setName] = useState('Subred escaneada')
  const [clientId, setClientId] = useState(NONE)

  const eff: Choice = choice ?? (unreg.length === 0 ? 'skip' : uncovered.length > 0 ? 'create' : 'register')
  const cidrV = cidr ?? suggested

  let error: string | null = null
  if (eff === 'create') {
    if (!z.cidrv4().safeParse(cidrV).success) error = 'CIDR no válido. Ej. 192.168.1.0/24'
    else if (!name.trim()) error = 'El nombre de la subred es obligatorio.'
    else if (uncovered.some((i) => !ipInCidr(i.ip_address, cidrV)))
      error = 'La subred indicada no contiene todas las IPs sin subred.'
  }
  const nothing = registered.length === 0 && eff === 'skip'

  const clientItems: Record<string, string> = { [NONE]: 'Sin cliente' }
  clientList.forEach((c) => { clientItems[String(c.id)] = c.full_name })
  const showClient = single && (registered.length > 0 || eff !== 'skip')

  const mutation = useMutation({
    mutationFn: () =>
      api.ips.commit({
        results: items.map((i) => ({ ip_address: i.ip_address, is_up: i.is_up })),
        method,
        register_unregistered: eff !== 'skip',
        new_subnet: eff === 'create' ? { cidr: cidrV, name: name.trim() } : null,
        client_id: showClient && clientId !== NONE ? Number(clientId) : null,
      }),
    onSuccess: (r) => {
      const parts = [`${r.updated} actualizada(s)`, `${r.registered} registrada(s)`]
      if (r.skipped) parts.push(`${r.skipped} omitida(s)`)
      if (r.subnet_created) parts.push(`subred ${r.subnet_created} creada`)
      toast.success(`Guardado: ${parts.join(', ')}.`)
      qc.invalidateQueries({ queryKey: ['ips'] })
      qc.invalidateQueries({ queryKey: ['subnets'] })
      onSaved()
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const one = items[0]
  const nextOne = single && clientId !== NONE ? 'ASSIGNED' : one?.next

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{single ? 'Actualizar estado de la IP' : 'Guardar estados escaneados'}</DialogTitle>
          <DialogDescription>
            {single ? 'Confirma el nuevo estado antes de guardarlo.' : `${items.length} IPs escaneadas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {single && one ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{one.ip_address}</span>
              {one.registered ? (
                <>
                  {isStatus(one.previous) && <StatusBadge status={one.previous} />}→
                  {isStatus(nextOne) && <StatusBadge status={nextOne} />}
                </>
              ) : (
                <span className="text-muted-foreground">No registrada</span>
              )}
            </div>
          ) : (
            <p>
              <b>{registered.length}</b> registrada(s) se actualizarán ({changed} cambian de estado).
              {unreg.length > 0 && <> <b>{unreg.length}</b> no están registradas.</>}
            </p>
          )}

          {unreg.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="font-medium">
                {single ? 'La IP no está registrada. ¿Qué hacer?' : 'IPs no registradas: ¿qué hacer?'}
              </p>
              <Opt checked={eff === 'skip'} onSelect={() => setChoice('skip')}>
                {single ? 'No registrarla' : 'Actualizar solo las ya registradas'}
              </Opt>
              <Opt checked={eff === 'register'} disabled={coveredCount === 0} onSelect={() => setChoice('register')}>
                Registrar {coveredCount} IP(s) en su subred existente
                {uncovered.length > 0 && coveredCount > 0 && ` (las otras ${uncovered.length} se omiten)`}
              </Opt>
              <Opt checked={eff === 'create'} disabled={uncovered.length === 0} onSelect={() => setChoice('create')}>
                Crear una subred y registrar {uncovered.length} IP(s) sin subred
              </Opt>
              {eff === 'create' && (
                <div className="grid gap-2 pl-6 sm:grid-cols-2">
                  <Input className="font-mono" value={cidrV} onChange={(e) => setCidr(e.target.value)} placeholder="192.168.1.0/24" />
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
                </div>
              )}
            </div>
          )}

          {showClient && (
            <div className="grid gap-1.5">
              <label className="font-medium">¿Asignar a un cliente? (opcional)</label>
              <Select value={clientId} items={clientItems} onValueChange={(v) => setClientId(v ?? NONE)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value={NONE}>Sin cliente</SelectItem>
                  {clientList.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {nothing && <p className="text-xs text-muted-foreground">No hay nada que guardar con estas opciones.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            {single ? 'No actualizar' : 'Cancelar'}
          </Button>
          <Button disabled={mutation.isPending || !!error || nothing} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Guardando...' : single ? 'Actualizar estado' : 'Guardar estados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}