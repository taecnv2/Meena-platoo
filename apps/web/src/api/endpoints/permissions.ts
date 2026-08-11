import { axiosClient } from '../axiosClient'
import type { Permission } from '@/types/entities'

export const permissionsApi = {
  list: () => axiosClient.get<Permission[]>('/permissions').then((response) => response.data),
}
