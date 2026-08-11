import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { PermissionCode } from '@/constants/permissions'
import { LoadingState } from '@/components/LoadingState'
import { AppLayout } from '@/layouts/AppLayout'

interface ProtectedRouteProps {
  permission?: PermissionCode
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="กำลังตรวจสอบสิทธิ์การใช้งาน..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const hasPermission = !permission || user?.isSuperScope || user?.permissions.includes(permission)

  return <AppLayout>{hasPermission ? <Outlet /> : <ForbiddenView />}</AppLayout>
}

function ForbiddenView() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <p className="text-lg font-semibold text-text-primary">ไม่มีสิทธิ์เข้าถึง</p>
      <p className="text-sm text-text-secondary">คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
    </div>
  )
}
