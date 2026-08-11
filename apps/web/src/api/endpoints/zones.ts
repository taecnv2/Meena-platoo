import { axiosClient } from '../axiosClient'
import { createCrudApi } from '../createCrudApi'
import type { Status, Zone, ZoneType } from '@/types/entities'

export interface CreateZonePayload {
  name: string
  code: string
  type: ZoneType
  description?: string
}

export type UpdateZonePayload = Partial<Omit<CreateZonePayload, 'code'>>

export const zonesApi = {
  ...createCrudApi<Zone, CreateZonePayload, UpdateZonePayload>('zones'),
  setStatus: (id: string, status: Status) =>
    axiosClient.patch<Zone>(`/zones/${id}/status`, { status }).then((response) => response.data),
}
