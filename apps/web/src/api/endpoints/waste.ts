import { axiosClient } from '../axiosClient'
import type { Waste, WasteReason, WasteStatus } from '@/types/entities'

export interface CreateWastePayload {
  zoneId: string
  ingredientId: string
  quantity: number
  reason: WasteReason
  remark?: string
}

export interface WasteFilter {
  status?: WasteStatus
  ingredientId?: string
  dateFrom?: string
  dateTo?: string
}

export const wasteApi = {
  list: (filter?: WasteFilter) =>
    axiosClient.get<Waste[]>('/waste', { params: filter }).then((r) => r.data),
  get: (id: string) => axiosClient.get<Waste>(`/waste/${id}`).then((response) => response.data),
  create: (payload: CreateWastePayload) =>
    axiosClient.post<Waste>('/waste', payload).then((response) => response.data),
  approve: (id: string) =>
    axiosClient.patch<Waste>(`/waste/${id}/approve`, {}).then((response) => response.data),
  reject: (id: string, rejectionReason: string) =>
    axiosClient.patch<Waste>(`/waste/${id}/reject`, { rejectionReason }).then((response) => response.data),
}
