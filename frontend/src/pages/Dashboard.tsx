import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { errorMessage } from '@/lib/http'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Dashboard() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card className="max-w-md">
        <CardHeader><CardTitle className="text-base">Conexión con la API</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            {health.isPending && 'Verificando...'}
            {health.isError && <span className="text-destructive">{errorMessage(health.error)}</span>}
            {health.isSuccess && <>Estado: <b>{health.data.status}</b></>}
          </p>
          <div className="flex gap-2">
            <StatusBadge status="FREE" />
            <StatusBadge status="ASSIGNED" />
            <StatusBadge status="ACTIVE" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}