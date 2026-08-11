import { createCrudApi } from '../createCrudApi'
import type { Role, Status } from '@/types/entities'

export interface CreateRolePayload {
  name: string
  description?: string
  permissions: string[]
  allZoneAccess?: boolean
  status?: Status
}

export type UpdateRolePayload = Partial<CreateRolePayload>

export const rolesApi = createCrudApi<Role, CreateRolePayload, UpdateRolePayload>('roles')
