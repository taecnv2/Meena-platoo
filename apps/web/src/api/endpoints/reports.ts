import { axiosClient } from '../axiosClient'
import { downloadFile } from '../downloadFile'
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
  exportZone: (format: 'csv' | 'pdf', filter?: ActivityReportFilter) =>
    downloadFile('/reports/zone/export', { ...filter, format }),
  exportRequisition: (format: 'csv' | 'pdf', filter?: ActivityReportFilter) =>
    downloadFile('/reports/requisition/export', { ...filter, format }),
  exportComparison: (format: 'csv' | 'pdf', periodType: ComparisonPeriodType, dateFrom?: string, dateTo?: string) =>
    downloadFile('/reports/comparison/export', { periodType, dateFrom, dateTo, format }),
  exportInventory: (format: 'csv' | 'pdf', filter?: ActivityReportFilter) =>
    downloadFile('/reports/inventory/export', { ...filter, format }),
  exportPurchase: (format: 'csv' | 'pdf', filter?: PurchaseReportFilter) =>
    downloadFile('/reports/purchase/export', { ...filter, format }),
  exportWaste: (format: 'csv' | 'pdf', filter?: ActivityReportFilter) =>
    downloadFile('/reports/waste/export', { ...filter, format }),
  exportCost: (format: 'csv' | 'pdf', filter?: ActivityReportFilter) =>
    downloadFile('/reports/cost/export', { ...filter, format }),
}
