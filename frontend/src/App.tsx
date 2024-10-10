import { FC } from 'react'
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
        path: ':pollId',
        element: <PollPage />,
      },
    ],
  },
])

export const App: FC = () => {
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
