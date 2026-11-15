import { axiosClient } from '../axiosClient'
import { createCrudApi } from '../createCrudApi'
import type { Status, Supplier } from '@/types/entities'

export interface CreateSupplierPayload {
  code: string
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  status?: Status
}

export type UpdateSupplierPayload = Partial<Omit<CreateSupplierPayload, 'code'>>

export const suppliersApi = {
  ...createCrudApi<Supplier, CreateSupplierPayload, UpdateSupplierPayload>('suppliers'),
  /** Hard delete; the API refuses (409) when a purchase order or stock-in references the supplier. */
  remove: (id: string) => axiosClient.delete<Supplier>(`/suppliers/${id}`).then((response) => response.data),
}
