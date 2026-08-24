import { axiosClient } from '../axiosClient'
import type {
  ComparisonPeriodType,
  ComparisonReport,
  CostReport,
  InventoryReportRow,
  PurchaseReport,
  RequisitionReport,
  WasteReport,
  ZoneReportRow,
} from '@/types/entities'

export interface ActivityReportFilter {
  dateFrom?: string
  dateTo?: string
  zoneId?: string
}

export interface PurchaseReportFilter {
  dateFrom?: string
  dateTo?: string
  supplierId?: string
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
  inventory: (filter?: ActivityReportFilter) =>
    axiosClient.get<InventoryReportRow[]>('/reports/inventory', { params: filter }).then((r) => r.data),
  purchase: (filter?: PurchaseReportFilter) =>
    axiosClient.get<PurchaseReport>('/reports/purchase', { params: filter }).then((r) => r.data),
  waste: (filter?: ActivityReportFilter) =>
    axiosClient.get<WasteReport>('/reports/waste', { params: filter }).then((r) => r.data),
  cost: (filter?: ActivityReportFilter) =>
    axiosClient.get<CostReport>('/reports/cost', { params: filter }).then((r) => r.data),
}
