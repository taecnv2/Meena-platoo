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

export const suppliersApi = createCrudApi<Supplier, CreateSupplierPayload, UpdateSupplierPayload>('suppliers')
