import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Placeholder } from '@/pages/Placeholder'

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: 'ips', element: <Placeholder title="Direcciones IP" phase="la Fase 2" /> },
        { path: 'subnets', element: <Placeholder title="Subredes" phase="la Fase 3" /> },
        { path: 'clients', element: <Placeholder title="Clientes" phase="la Fase 3" /> },
        { path: 'scan', element: <Placeholder title="Escaneo y consulta" phase="la Fase 3" /> },
        { path: '*', element: <Placeholder title="No encontrado" phase="ninguna fase" /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }, // '/app/'
)