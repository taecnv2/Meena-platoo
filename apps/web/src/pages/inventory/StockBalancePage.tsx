import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/endpoints/inventory'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { ExportButton } from '@/components/ExportButton'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { formatQuantity } from '@/utils/format'
import type { ZoneStock } from '@/types/entities'

export function StockBalancePage() {
  const canExport = usePermission(PERMISSIONS.INVENTORY_EXPORT)
  const accessibleZoneIds = useAccessibleZoneIds()
  const [zoneFilter, setZoneFilter] = useState('')

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })
  const { data: balances, isLoading } = useQuery({
    queryKey: ['inventory', 'balances', zoneFilter],
    queryFn: () => inventoryApi.balances(zoneFilter ? { zoneId: zoneFilter } : undefined),
  })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i])), [ingredients])
  const unitMap = useMemo(() => new Map((units ?? []).map((u) => [u._id, u.name])), [units])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])

  const accessibleZones = useMemo(
    () => (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id)),
    [zones, accessibleZoneIds],
  )

  const rows = useMemo(
    () => (balances ?? []).filter((b) => b.quantity > 0 || zoneFilter),
    [balances, zoneFilter],
  )

  const columns: Array<DataTableColumn<ZoneStock>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId)?.name ?? '-' },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    {
      key: 'quantity',
      header: 'จำนวนคงเหลือ',
      render: (row) => {
        const ingredient = ingredientMap.get(row.ingredientId)
        const unitName = ingredient ? (unitMap.get(ingredient.baseUnitId) ?? '') : ''
        return formatQuantity(row.quantity, unitName)
      },
    },
    {
      key: 'level',
      header: 'สถานะสต๊อก',
      render: (row) => {
        const ingredient = ingredientMap.get(row.ingredientId)
        if (!ingredient) return '-'
        if (row.quantity <= 0) return <Badge color="danger">หมดสต๊อก</Badge>
        if (row.quantity <= ingredient.minimumStock) return <Badge color="warning">ใกล้หมด</Badge>
        return <Badge color="success">ปกติ</Badge>
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">สต๊อกคงเหลือ</h1>
          <p className="text-sm text-text-secondary">ดูจำนวนวัตถุดิบคงเหลือแยกตาม Zone</p>
        </div>
        {canExport ? (
          <ExportButton onExport={(format) => inventoryApi.exportFile(format, zoneFilter ? { zoneId: zoneFilter } : undefined)} />
        ) : null}
      </div>

      <div className="max-w-xs">
        <Select
          label="Zone"
          placeholder="ทุก Zone ที่มีสิทธิ์เข้าถึง"
          options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
          value={zoneFilter}
          onChange={(event) => setZoneFilter(event.target.value)}
        />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ไม่มีข้อมูลสต๊อก" />
    </div>
  )
}
