import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/api/endpoints/auth'
import { setAccessToken } from '@/api/tokenStore'
import type { AuthUser } from '@/types/auth'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  completePasswordChange: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const result = await authApi.refresh()
        if (!cancelled) {
          setAccessToken(result.accessToken)
          setUser(result.user)
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password)
    setAccessToken(result.accessToken)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const completePasswordChange = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: user !== null, login, logout, completePasswordChange }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
