import { axiosClient } from '../axiosClient'
import type { StockMovement, StockOutReason, ZoneStock } from '@/types/entities'

/** `quantity`/`unitCost` are in `unitId` (default: the ingredient's base unit); the API converts to base. */
export interface StockInPayload {
  ingredientId: string
  zoneId: string
  quantity: number
  unitId?: string
  unitCost?: number
  weight?: number
  supplierId?: string
  invoiceNo?: string
  remark?: string
}

export interface StockOutPayload {
  ingredientId: string
  zoneId: string
  quantity: number
  unitId?: string
  reason?: StockOutReason
  weight?: number
  remark?: string
}

export interface AdjustmentPayload {
  ingredientId: string
  zoneId: string
  quantityDelta: number
  unitId?: string
  reason: string
  remark?: string
}

export interface StockMovementFilter {
  ingredientId?: string
  zoneId?: string
  movementType?: string
  dateFrom?: string
  dateTo?: string
}

export const inventoryApi = {
  balances: (params?: { zoneId?: string; ingredientId?: string }) =>
    axiosClient.get<ZoneStock[]>('/inventory/balances', { params }).then((response) => response.data),
  stockIn: (payload: StockInPayload) =>
    axiosClient.post<StockMovement>('/inventory/stock-in', payload).then((response) => response.data),
  stockOut: (payload: StockOutPayload) =>
    axiosClient.post<StockMovement>('/inventory/stock-out', payload).then((response) => response.data),
  adjust: (payload: AdjustmentPayload) =>
    axiosClient.post<StockMovement>('/inventory/adjust', payload).then((response) => response.data),
}

export const stockMovementsApi = {
  list: (params?: StockMovementFilter) =>
    axiosClient.get<StockMovement[]>('/stock-movements', { params }).then((response) => response.data),
}
