import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockMovementsApi } from '@/api/endpoints/inventory'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { MOVEMENT_TYPE_LABEL } from '@/constants/labels'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { formatDateTime, formatQuantity } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { MOVEMENT_TYPES, type MovementType, type StockMovement } from '@/types/entities'

const INCOMING_TYPES: MovementType[] = ['STOCK_IN', 'TRANSFER_IN', 'ADJUSTMENT_IN']

export function MovementsPage() {
  const canExport = usePermission(PERMISSIONS.INVENTORY_EXPORT)
  const [ingredientFilter, setIngredientFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements', ingredientFilter, zoneFilter, typeFilter, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      stockMovementsApi.list({
        ingredientId: ingredientFilter || undefined,
        zoneId: zoneFilter || undefined,
        movementType: typeFilter || undefined,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])

  const columns: Array<DataTableColumn<StockMovement>> = [
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId) ?? '-' },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    {
      key: 'type',
      header: 'ประเภท',
      render: (row) => (
        <Badge color={INCOMING_TYPES.includes(row.movementType) ? 'success' : row.movementType === 'WASTE' ? 'danger' : 'gray'}>
          {MOVEMENT_TYPE_LABEL[row.movementType]}
        </Badge>
      ),
    },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatQuantity(row.quantity, row.unit) },
    { key: 'reason', header: 'เหตุผล/หมายเหตุ', render: (row) => row.reason ?? row.remark ?? '-' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">ประวัติการเคลื่อนไหวสต๊อก</h1>
          <p className="text-sm text-text-secondary">ประวัติการรับ-จ่าย-โอน-ปรับปรุงสต๊อกทั้งหมด</p>
        </div>
        {canExport ? (
          <ExportButton
            onExport={(format) =>
              stockMovementsApi.exportFile(format, {
                ingredientId: ingredientFilter || undefined,
                zoneId: zoneFilter || undefined,
                movementType: typeFilter || undefined,
                dateFrom: dateRange.dateFrom ?? undefined,
                dateTo: dateRange.dateTo ?? undefined,
              })
            }
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="วัตถุดิบ"
          placeholder="ทุกวัตถุดิบ"
          options={(ingredients ?? []).map((i) => ({ value: i._id, label: i.name }))}
          value={ingredientFilter}
          onChange={(event) => setIngredientFilter(event.target.value)}
        />
        <Select
          label="Zone"
          placeholder="ทุก Zone"
          options={(zones ?? []).map((z) => ({ value: z._id, label: z.name }))}
          value={zoneFilter}
          onChange={(event) => setZoneFilter(event.target.value)}
        />
        <Select
          label="ประเภท"
          placeholder="ทุกประเภท"
          options={MOVEMENT_TYPES.map((type) => ({ value: type, label: MOVEMENT_TYPE_LABEL[type] }))}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        />
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <DataTable columns={columns} rows={movements ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ไม่มีประวัติการเคลื่อนไหว" />
    </div>
  )
}
