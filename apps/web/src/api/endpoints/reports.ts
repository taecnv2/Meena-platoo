import { axiosClient } from '../axiosClient'
import type { ComparisonPeriodType, ComparisonReport, RequisitionReport, ZoneReportRow } from '@/types/entities'

export interface ActivityReportFilter {
  dateFrom?: string
  dateTo?: string
  zoneId?: string
}

export const reportsApi = {
  zone: (filter?: ActivityReportFilter) =>
    axiosClient.get<ZoneReportRow[]>('/reports/zone', { params: filter }).then((r) => r.data),
  requisition: (filter?: ActivityReportFilter) =>
    axiosClient.get<RequisitionReport>('/reports/requisition', { params: filter }).then((r) => r.data),
  comparison: (periodType: ComparisonPeriodType, dateFrom?: string, dateTo?: string) =>
    axiosClient
      .get<ComparisonReport>('/reports/comparison', { params: { periodType, dateFrom, dateTo } })
      .then((r) => r.data),
}
