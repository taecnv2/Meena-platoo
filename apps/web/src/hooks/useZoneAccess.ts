import { useAuth } from '@/features/auth/AuthContext'

export function useZoneAccess(zoneId: string | undefined): boolean {
  const { user } = useAuth()
  if (!user || !zoneId) {
    return false
  }
  return user.isSuperScope || user.zoneIds.includes(zoneId)
}

export function useAccessibleZoneIds(): string[] | undefined {
  const { user } = useAuth()
  if (!user) {
    return []
  }
  return user.isSuperScope ? undefined : user.zoneIds
}
