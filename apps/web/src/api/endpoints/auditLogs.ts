import { axiosClient } from '../axiosClient'
import type { AuditAction, AuditLog } from '@/types/entities'

export interface AuditLogsFilter {
  userId?: string
  entity?: string
  action?: AuditAction
  dateFrom?: string
  dateTo?: string
}

export const auditLogsApi = {
  list: (filter?: AuditLogsFilter) =>
    axiosClient.get<AuditLog[]>('/audit-logs', { params: filter }).then((r) => r.data),
}
