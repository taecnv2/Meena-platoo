import { axiosClient } from '../axiosClient'
import type { StockMovement, ZoneStock } from '@/types/entities'

export interface StockInPayload {
  ingredientId: string
  zoneId: string
  quantity: number
  unitCost?: number
  remark?: string
}

export interface StockOutPayload {
  ingredientId: string
  zoneId: string
  quantity: number
  remark?: string
}

export interface AdjustmentPayload {
  ingredientId: string
  zoneId: string
  quantityDelta: number
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
