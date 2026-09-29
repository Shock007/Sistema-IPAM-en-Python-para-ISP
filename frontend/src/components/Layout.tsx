import { NavLink, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LayoutDashboard, Network, Server, Users, Radar } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ips', label: 'Direcciones IP', icon: Network },
  { to: '/subnets', label: 'Subredes', icon: Server },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/scan', label: 'Escaneo', icon: Radar },
]

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
          {/* Fase 4: contador de alertas (ACTIVE sin cliente) */}
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}