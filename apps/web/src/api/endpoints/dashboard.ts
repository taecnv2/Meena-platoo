import { axiosClient } from '../axiosClient'
import type { DashboardSummary } from '@/types/entities'

export interface DashboardSummaryFilter {
  dateFrom?: string
  dateTo?: string
}

export const dashboardApi = {
  ownerSummary: (filter?: DashboardSummaryFilter) =>
    axiosClient.get<DashboardSummary>('/dashboard/owner', { params: filter }).then((response) => response.data),
}
