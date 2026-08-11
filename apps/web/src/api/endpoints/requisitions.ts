import { axiosClient } from '../axiosClient'
import type { Requisition, RequisitionStatus } from '@/types/entities'

export interface CreateRequisitionPayload {
  fromZoneId: string
  toZoneId: string
  items: Array<{ ingredientId: string; requestedQuantity: number }>
}

export interface ApproveRequisitionPayload {
  items?: Array<{ ingredientId: string; approvedQuantity: number }>
}

export interface FulfillRequisitionPayload {
  fromZoneId: string
  items: Array<{ ingredientId: string; quantity: number }>
}

export const requisitionsApi = {
  list: (status?: RequisitionStatus) =>
    axiosClient.get<Requisition[]>('/requisitions', { params: status ? { status } : undefined }).then((r) => r.data),
  get: (id: string) => axiosClient.get<Requisition>(`/requisitions/${id}`).then((response) => response.data),
  create: (payload: CreateRequisitionPayload) =>
    axiosClient.post<Requisition>('/requisitions', payload).then((response) => response.data),
  approve: (id: string, payload: ApproveRequisitionPayload) =>
    axiosClient.patch<Requisition>(`/requisitions/${id}/approve`, payload).then((response) => response.data),
  reject: (id: string, rejectionReason: string) =>
    axiosClient.patch<Requisition>(`/requisitions/${id}/reject`, { rejectionReason }).then((response) => response.data),
  fulfill: (id: string, payload: FulfillRequisitionPayload) =>
    axiosClient.patch<Requisition>(`/requisitions/${id}/fulfill`, payload).then((response) => response.data),
  cancel: (id: string) => axiosClient.patch<Requisition>(`/requisitions/${id}/cancel`, {}).then((response) => response.data),
}
