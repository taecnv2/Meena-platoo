import { createCrudApi } from '../createCrudApi'
import type { Ingredient, IngredientUnitConversion, Status } from '@/types/entities'

export interface CreateIngredientPayload {
  code: string
  name: string
  categoryId: string
  baseUnitId: string
  minimumStock?: number
  maximumStock?: number
  defaultCost?: number
  description?: string
  unitConversions?: IngredientUnitConversion[]
  tags?: string[]
  consignmentOwner?: string | null
  status?: Status
}

export type UpdateIngredientPayload = Partial<Omit<CreateIngredientPayload, 'code'>>

export const ingredientsApi = createCrudApi<Ingredient, CreateIngredientPayload, UpdateIngredientPayload>('ingredients')
