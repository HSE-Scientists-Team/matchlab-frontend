import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, sessionStore } from '../api/client'
import type { Session, Staff } from '../api/types'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Alert, Spinner } from '../ui/primitives'
const AuthContext = createContext<{ session: Session | null; staff?: Staff }>({ session: null })
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  const client = useQueryClient()
  const me = useQuery({
    queryKey: ['me', session?.token],
    queryFn: ({ signal }) => api<Staff>('/me', { signal }),
    enabled: !!session,
    retry: false,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (!session) {
      client.clear()
      return
    }
    const timer = window.setTimeout(
      () => sessionStore.set(null),
      Math.max(0, session.expires - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [session, client])
  return (
    <AuthContext.Provider value={{ session, staff: me.data }}>
      {session && me.isPending ? (
        <div className="fullscreen">
          <Spinner />
        </div>
      ) : session && me.isError ? (
        <div className="fullscreen">
          <Alert error={me.error} retry={() => void me.refetch()} />
          <button className="btn quiet" onClick={() => sessionStore.set(null)}>
            Вернуться ко входу
          </button>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}
export const useAuth = () => useContext(AuthContext)
export function Protected() {
  const { session } = useAuth()
  const location = useLocation()
  return session ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  )
}
export function Administrator() {
  const { staff } = useAuth()
  return staff?.role === 'administrator' ? <Outlet /> : <Navigate to="/" replace />
}
