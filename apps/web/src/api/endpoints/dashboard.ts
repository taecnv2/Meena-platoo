import { axiosClient } from '../axiosClient'
import type { DashboardSummary } from '@/types/entities'

export const dashboardApi = {
  ownerSummary: () => axiosClient.get<DashboardSummary>('/dashboard/owner').then((response) => response.data),
}
