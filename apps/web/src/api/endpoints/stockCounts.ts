import { axiosClient } from '../axiosClient'
import type { StockCount } from '@/types/entities'

export interface CreateStockCountPayload {
  zoneId: string
  items: Array<{ ingredientId: string; actualQuantity: number }>
}

export const stockCountsApi = {
  list: () => axiosClient.get<StockCount[]>('/stock-counts').then((response) => response.data),
  get: (id: string) => axiosClient.get<StockCount>(`/stock-counts/${id}`).then((response) => response.data),
  create: (payload: CreateStockCountPayload) =>
    axiosClient.post<StockCount>('/stock-counts', payload).then((response) => response.data),
  approve: (id: string) => axiosClient.patch<StockCount>(`/stock-counts/${id}/approve`, {}).then((response) => response.data),
}
