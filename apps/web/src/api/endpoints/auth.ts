import { axiosClient } from '../axiosClient'
import type { AuthResponse, AuthUser } from '@/types/auth'

export const authApi = {
  login: (username: string, password: string) =>
    axiosClient.post<AuthResponse>('/auth/login', { username, password }).then((response) => response.data),
  refresh: () => axiosClient.post<AuthResponse>('/auth/refresh').then((response) => response.data),
  logout: () => axiosClient.post('/auth/logout').then((response) => response.data),
  me: () => axiosClient.get<AuthUser>('/auth/me').then((response) => response.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    axiosClient.post('/auth/change-password', { currentPassword, newPassword }).then((response) => response.data),
}
