import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { LoadingState } from '@/components/LoadingState'
import { getDefaultRouteForUser } from '@/constants/nav'

export function RequirePasswordChange({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="กำลังตรวจสอบสิทธิ์การใช้งาน..." />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.mustChangePassword) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />
  }

  return <>{children}</>
}
