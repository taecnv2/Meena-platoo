import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { unitsApi } from '@/api/endpoints/units'

/**
 * Report endpoints return unit *codes* (KG, BOTTLE); staff read unit names (กิโลกรัม, ขวด).
 * Falls back to the code while units load or for unknown codes.
 */
export function useUnitNameByCode(): (code: string) => string {
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })
  const names = useMemo(() => new Map((units ?? []).map((unit) => [unit.code, unit.name])), [units])
  return useCallback((code: string) => names.get(code) ?? code, [names])
}
