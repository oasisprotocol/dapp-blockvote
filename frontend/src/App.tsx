import { FC, useEffect } from 'react'
import { createHashRouter, Outlet, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AppStateContextProvider } from './providers/AppStateProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouterErrorBoundary } from './components/RouterErrorBoundary'
import { EthereumContextProvider } from './providers/EthereumProvider'
import { PollPage } from './pages/PollPage'
import { DashboardPage } from './pages/DashboardPage'
import { CreatePollPage } from './pages/CreatePollPage'
import { ContractContextProvider } from './providers/ContractProvider'
import {
  VITE_APP_DARK_BG,
  VITE_APP_DASHBOARD_BG,
  VITE_APP_LANDING_BG,
  VITE_APP_LIGHT_BG,
} from './constants/config'

const router = createHashRouter([
  {
    path: '/',
    element: <Outlet />,
    errorElement: <RouterErrorBoundary />,
    children: [
      {
        path: '',
        element: <DashboardPage />,
      },
      {
        path: 'create',
        element: <CreatePollPage />,
      },
      {
        path: ':slug',
        element: <PollPage />,
      },
    ],
  },
])

export const App: FC = () => {
  useEffect(() => {
    if (VITE_APP_LANDING_BG) document.documentElement.style.setProperty('--landing-bg', VITE_APP_LANDING_BG)
    if (VITE_APP_DASHBOARD_BG)
      document.documentElement.style.setProperty('--dashboard-bg', VITE_APP_DASHBOARD_BG)
    if (VITE_APP_LIGHT_BG) document.documentElement.style.setProperty('--light-bg', VITE_APP_LIGHT_BG)
    if (VITE_APP_DARK_BG) document.documentElement.style.setProperty('--dark-bg', VITE_APP_DARK_BG)
  }, [])
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <EthereumContextProvider>
          <ContractContextProvider>
            <AppStateContextProvider>
              <RouterProvider router={router} />
            </AppStateContextProvider>
          </ContractContextProvider>
        </EthereumContextProvider>
      </ErrorBoundary>
    </HelmetProvider>
  )
}
