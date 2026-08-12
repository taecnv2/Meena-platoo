import { axiosClient } from '../axiosClient'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/entities'

export interface CreatePurchaseOrderPayload {
  supplierId: string
  items: Array<{ ingredientId: string; orderedQuantity: number; unitCost: number }>
  remark?: string
}

export interface ReceivePurchaseOrderPayload {
  items: Array<{ ingredientId: string; quantity?: number }>
}

export interface PurchaseOrdersFilter {
  status?: PurchaseOrderStatus
  supplierId?: string
  dateFrom?: string
  dateTo?: string
}

export const purchasingApi = {
  list: (filter?: PurchaseOrdersFilter) =>
    axiosClient.get<PurchaseOrder[]>('/purchasing', { params: filter }).then((r) => r.data),
  get: (id: string) => axiosClient.get<PurchaseOrder>(`/purchasing/${id}`).then((response) => response.data),
  create: (payload: CreatePurchaseOrderPayload) =>
    axiosClient.post<PurchaseOrder>('/purchasing', payload).then((response) => response.data),
  submit: (id: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/submit`, {}).then((response) => response.data),
  approve: (id: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/approve`, {}).then((response) => response.data),
  reject: (id: string, rejectionReason: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/reject`, { rejectionReason }).then((response) => response.data),
  receive: (id: string, payload: ReceivePurchaseOrderPayload) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/receive`, payload).then((response) => response.data),
  cancel: (id: string) =>
    axiosClient.patch<PurchaseOrder>(`/purchasing/${id}/cancel`, {}).then((response) => response.data),
}
