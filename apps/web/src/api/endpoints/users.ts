import { axiosClient } from '../axiosClient'
import { createCrudApi } from '../createCrudApi'
import type { Status, UserAccount } from '@/types/entities'

export interface CreateUserPayload {
  username: string
  email: string
  name: string
  roleId: string
  zoneIds?: string[]
  status?: Status
}

export type UpdateUserPayload = Partial<CreateUserPayload>

export const usersApi = {
  ...createCrudApi<UserAccount, CreateUserPayload, UpdateUserPayload>('users'),
  setStatus: (id: string, status: Status) =>
    axiosClient.patch<UserAccount>(`/users/${id}/status`, { status }).then((response) => response.data),
  resetPassword: (id: string, newPassword: string) =>
    axiosClient.patch(`/users/${id}/reset-password`, { newPassword }).then((response) => response.data),
  getDefaultPassword: () =>
    axiosClient.get<{ password: string }>('/users/default-password').then((response) => response.data),
}
