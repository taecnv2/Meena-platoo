import { axiosClient } from '../axiosClient'
import type {
  ComparisonPeriodType,
  ComparisonReport,
  ConsignmentOwnerReport,
  CostReport,
  LedgerReport,
  SupplierStatement,
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

export interface LedgerFilter {
  dateFrom: string
  dateTo: string
  zoneId?: string
  categoryId?: string
}

export interface SupplierStatementFilter {
  supplierId: string
  dateFrom?: string
  dateTo?: string
}

export interface ConsignmentFilter {
  dateFrom?: string
  dateTo?: string
  owner?: string
}

export const reportsApi = {
  ledger: (filter: LedgerFilter) =>
    axiosClient.get<LedgerReport>('/reports/ledger', { params: filter }).then((r) => r.data),
  supplierStatement: (filter: SupplierStatementFilter) =>
    axiosClient.get<SupplierStatement>('/reports/supplier-statement', { params: filter }).then((r) => r.data),
  consignment: (filter?: ConsignmentFilter) =>
    axiosClient.get<ConsignmentOwnerReport[]>('/reports/consignment', { params: filter }).then((r) => r.data),
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
