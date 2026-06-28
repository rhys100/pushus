import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui'
import { AuthProvider } from '@/providers/AuthProvider'
import { GroupProvider } from '@/providers/GroupProvider'
import { NotificationPreferencesProvider } from '@/providers/NotificationPreferencesProvider'
import App from './App'
import { APP_BUILD_ID } from '@/lib/buildId'
import { confirmAppBuildAfterReload } from '@/lib/reloadApp'
import './index.css'
import 'ios-vibrator-pro-max'

confirmAppBuildAfterReload(APP_BUILD_ID)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationPreferencesProvider>
              <GroupProvider>
                <App />
              </GroupProvider>
            </NotificationPreferencesProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
