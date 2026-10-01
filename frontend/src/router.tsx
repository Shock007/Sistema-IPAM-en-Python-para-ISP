import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Placeholder } from '@/pages/Placeholder'
import { IPsPage } from '@/pages/IPs'
import { ScanPage } from '@/pages/Scan'
import { SubnetsPage } from '@/pages/Subnets'
import { ClientsPage } from '@/pages/Clients'

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: 'ips', element: <IPsPage /> },
        { path: 'subnets', element: <SubnetsPage /> },
        { path: 'clients', element: <ClientsPage /> },
        { path: 'scan', element: <ScanPage /> },
        { path: '*', element: <Placeholder title="No encontrado" phase="ninguna fase" /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }, // '/app/'
)