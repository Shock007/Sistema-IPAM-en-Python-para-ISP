import { cn } from '@/lib/utils'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Network, Server, Users, Radar, Bell } from 'lucide-react'
import { api } from '@/api/endpoints'



const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ips', label: 'Direcciones IP', icon: Network },
  { to: '/subnets', label: 'Subredes', icon: Server },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/scan', label: 'Escaneo', icon: Radar },
]

function AlertsBadge() {
  const stats = useQuery({
    queryKey: ['ips', 'stats'],
    queryFn: () => api.ips.stats(),
    refetchInterval: 60_000,
  })
  const n = stats.data?.active ?? 0

  return (
    <Link
      to="/ips?status=ACTIVE"
      title="IPs que responden sin cliente asignado"
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
        n > 0
          ? 'bg-status-active text-status-active-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      <Bell className="size-4" />
      {n > 0 ? `${n} alerta${n === 1 ? '' : 's'}` : 'Sin alertas'}
    </Link>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 p-4 md:block">
        <div className="mb-6 flex items-center gap-2 font-semibold">
          <Network className="size-5" /> IPAM
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <span className="text-sm text-muted-foreground">Sistema IPAM para ISP</span>
                    <AlertsBadge />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}