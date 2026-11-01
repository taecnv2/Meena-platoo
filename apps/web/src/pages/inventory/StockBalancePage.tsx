import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/endpoints/inventory'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { ExportButton } from '@/components/ExportButton'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { formatQuantity } from '@/utils/format'
import { formatPackBreakdown } from '@/utils/units'
import type { ExcelColumn } from '@/utils/excel'
import type { ZoneStock } from '@/types/entities'
import { todayStamp } from './components/inventoryFormat'

export function StockBalancePage() {
  const accessibleZoneIds = useAccessibleZoneIds()
  const [zoneFilter, setZoneFilter] = useState('')
  const [search, setSearch] = useState('')

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

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (balances ?? []).filter((b) => {
      if (!(b.quantity > 0 || zoneFilter)) return false
      if (!keyword) return true
      const ingredient = ingredientMap.get(b.ingredientId)
      return (
        (ingredient?.name.toLowerCase().includes(keyword) ?? false) ||
        (ingredient?.code.toLowerCase().includes(keyword) ?? false)
      )
    })
  }, [balances, zoneFilter, search, ingredientMap])

  const getBaseUnitName = (row: ZoneStock) => {
    const ingredient = ingredientMap.get(row.ingredientId)
    return ingredient ? (unitMap.get(ingredient.baseUnitId) ?? '') : ''
  }
  const getPackBreakdown = (row: ZoneStock) => formatPackBreakdown(row.quantity, ingredientMap.get(row.ingredientId), units)

  const columns: Array<DataTableColumn<ZoneStock>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId)?.name ?? '-' },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    {
      key: 'quantity',
      header: 'จำนวนคงเหลือ',
      render: (row) => {
        const breakdown = getPackBreakdown(row)
        return (
          <div className="flex flex-col">
            <span>{formatQuantity(row.quantity, getBaseUnitName(row))}</span>
            {breakdown ? <span className="text-xs text-text-secondary">= {breakdown}</span> : null}
          </div>
        )
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

  const exportColumns: Array<ExcelColumn<ZoneStock>> = [
    { header: 'รหัส', value: (row) => ingredientMap.get(row.ingredientId)?.code ?? '', width: 14 },
    { header: 'วัตถุดิบ', value: (row) => ingredientMap.get(row.ingredientId)?.name ?? '', width: 30 },
    { header: 'Zone', value: (row) => zoneMap.get(row.zoneId) ?? '', width: 20 },
    { header: 'คงเหลือ', value: (row) => row.quantity, width: 12 },
    { header: 'หน่วย', value: (row) => getBaseUnitName(row), width: 10 },
    { header: 'แยกเป็นแพ็ค', value: (row) => getPackBreakdown(row) ?? '', width: 22 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">สต๊อกคงเหลือ</h1>
          <p className="text-sm text-text-secondary">ดูจำนวนวัตถุดิบคงเหลือแยกตาม Zone</p>
        </div>
        <ExportButton fileName={`สต๊อกคงเหลือ-${todayStamp()}`} columns={exportColumns} rows={rows} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:max-w-2xl sm:grid-cols-2">
        <Input
          id="stock-balance-search"
          label="ค้นหาวัตถุดิบ"
          type="search"
          placeholder="ชื่อหรือรหัสวัตถุดิบ"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          id="stock-balance-zone"
          label="Zone"
          placeholder="ทุก Zone ที่มีสิทธิ์เข้าถึง"
          options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
          value={zoneFilter}
          onChange={(event) => setZoneFilter(event.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        emptyMessage={search.trim() ? 'ไม่พบวัตถุดิบที่ค้นหา' : 'ไม่มีข้อมูลสต๊อก'}
      />
    </div>
  )
}
