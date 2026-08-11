import { axiosClient } from '../axiosClient'
import type { Transfer } from '@/types/entities'

export interface CreateTransferPayload {
  fromZoneId: string
  toZoneId: string
  items: Array<{ ingredientId: string; quantity: number }>
}

export interface TransfersFilter {
  dateFrom?: string
  dateTo?: string
}

export const transfersApi = {
  list: (filter?: TransfersFilter) => axiosClient.get<Transfer[]>('/transfers', { params: filter }).then((response) => response.data),
  get: (id: string) => axiosClient.get<Transfer>(`/transfers/${id}`).then((response) => response.data),
  create: (payload: CreateTransferPayload) =>
    axiosClient.post<Transfer>('/transfers', payload).then((response) => response.data),
}
