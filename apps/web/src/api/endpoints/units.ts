import { createCrudApi } from '../createCrudApi'
import type { Status, Unit, UnitType } from '@/types/entities'

export interface CreateUnitPayload {
  code: string
  name: string
  type: UnitType
  conversionFactor?: number
  status?: Status
}

export type UpdateUnitPayload = Partial<Omit<CreateUnitPayload, 'code'>>

export const unitsApi = createCrudApi<Unit, CreateUnitPayload, UpdateUnitPayload>('units')
