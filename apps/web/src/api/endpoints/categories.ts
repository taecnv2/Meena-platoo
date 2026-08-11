import { createCrudApi } from '../createCrudApi'
import type { Category, Status } from '@/types/entities'

export interface CreateCategoryPayload {
  code: string
  name: string
  description?: string
  status?: Status
}

export type UpdateCategoryPayload = Partial<Omit<CreateCategoryPayload, 'code'>>

export const categoriesApi = createCrudApi<Category, CreateCategoryPayload, UpdateCategoryPayload>('categories')
