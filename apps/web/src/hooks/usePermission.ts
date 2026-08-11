import { useAuth } from '@/features/auth/AuthContext'
import type { PermissionCode } from '@/constants/permissions'

export function usePermission(code: PermissionCode): boolean {
  const { user } = useAuth()
  if (!user) {
    return false
  }
  return user.permissions.includes(code)
}
