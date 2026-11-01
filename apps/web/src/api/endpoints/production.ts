import { axiosClient } from '../axiosClient'
import type { ProductionBatch } from '@/types/entities'

export interface CreateProductionPayload {
  zoneId: string
  inputIngredientId: string
  /** In `inputUnitId` (default: the raw ingredient's base unit). */
  inputQuantity: number
  inputUnitId?: string
  /** Cost per entered input unit (e.g. 440 บาท/kg); defaults to the raw ingredient's defaultCost. */
  inputUnitCost?: number
  outputs: Array<{
    ingredientId: string
    quantity: number
    unitId?: string
    /** Grams per entered unit; when every output has one the raw cost is split by weight. */
    portionWeight?: number
  }>
  /** Trim/scrap in the input's entered unit (yield tracking only). */
  wasteQuantity?: number
  /** Copy each output's computed cost per unit onto the ingredient's defaultCost. */
  updateDefaultCost?: boolean
  remark?: string
}

export interface ProductionFilter {
  zoneId?: string
  ingredientId?: string
  dateFrom?: string
  dateTo?: string
}

export const productionApi = {
  list: (filter?: ProductionFilter) =>
    axiosClient.get<ProductionBatch[]>('/production', { params: filter }).then((r) => r.data),
  get: (id: string) => axiosClient.get<ProductionBatch>(`/production/${id}`).then((r) => r.data),
  create: (payload: CreateProductionPayload) =>
    axiosClient.post<ProductionBatch>('/production', payload).then((r) => r.data),
}
