import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import './styles.css'
import { ApiError } from './api/client'
import { AuthProvider, Protected, Administrator } from './auth/Auth'
import { Layout } from './ui/layout'
import { LoginPage } from './features/login'
import { Overview } from './features/overview'
import { Tickets, Achievements, Users, Projects, Domains, StaffList, Audit } from './features/lists'
import {
  TicketDetail,
  AchievementDetail,
  UserDetail,
  ProjectDetail,
  StaffDetail,
} from './features/details'
import { SettingsPage } from './features/settings'
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Never log sensitive response data. */
  }
  render() {
    return this.state.failed ? (
      <div className="fullscreen">
        <h1>Не удалось открыть страницу</h1>
        <p>Обновите приложение и попробуйте снова.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
      </div>
    ) : (
      this.props.children
    )
  }
}
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => count < 1 && error instanceof ApiError && error.status >= 500,
    },
    mutations: { retry: false },
  },
})
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="achievements/:id" element={<AchievementDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="domains" element={<Domains />} />
          <Route path="audit" element={<Audit />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<Administrator />}>
            <Route path="staff" element={<StaffList />} />
            <Route path="staff/:id" element={<StaffDetail />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Страница не найдена</h1>
                <Link className="btn primary" to="/">
                  На обзор
                </Link>
              </div>
            }
          />
        </Route>
      </Route>
    </Routes>
  )
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
      <QueryClientProvider client={client}>
        <BrowserRouter basename="/admin">
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Boundary>
  </React.StrictMode>,
)
