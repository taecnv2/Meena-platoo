export interface AuthUser {
  id: string
  username: string
  roleId: string
  roleName: string
  permissions: string[]
  zoneIds: string[]
  isSuperScope: boolean
  mustChangePassword: boolean
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}
