import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/endpoints/reports'
import { zonesApi } from '@/api/endpoints/zones'
import { Badge } from '@/components/Badge'
import { Select } from '@/components/Select'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { STOCK_STATUS_COLOR, STOCK_STATUS_LABEL } from '@/constants/labels'
import { formatCurrency, formatQuantity } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { InventoryReportRow } from '@/types/entities'

export function InventoryReportPage() {
  const canExport = usePermission(PERMISSIONS.REPORTS_EXPORT)
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))
  const [zoneFilter, setZoneFilter] = useState('')

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'inventory', dateRange.dateFrom, dateRange.dateTo, zoneFilter],
    queryFn: () =>
      reportsApi.inventory({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
        zoneId: zoneFilter || undefined,
      }),
  })

  const columns: Array<DataTableColumn<InventoryReportRow>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => row.ingredientName },
    { key: 'quantity', header: 'จำนวนคงเหลือ', render: (row) => formatQuantity(row.totalQuantity, row.unit) },
    { key: 'value', header: 'มูลค่าคงเหลือ', render: (row) => formatCurrency(row.totalValue) },
    {
      key: 'status',
      header: 'สถานะสต๊อก',
      render: (row) => <Badge color={STOCK_STATUS_COLOR[row.stockStatus]}>{STOCK_STATUS_LABEL[row.stockStatus]}</Badge>,
    },
    { key: 'in', header: 'รับเข้า', render: (row) => formatQuantity(row.movementInQuantity, row.unit) },
    { key: 'out', header: 'จ่ายออก', render: (row) => formatQuantity(row.movementOutQuantity, row.unit) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">รายงานสต๊อก</h1>
          <p className="text-sm text-text-secondary">สต๊อกคงเหลือ สถานะ และการเคลื่อนไหวของแต่ละวัตถุดิบ</p>
        </div>
        {canExport ? (
          <ExportButton
            onExport={(format) =>
              reportsApi.exportInventory(format, {
                dateFrom: dateRange.dateFrom ?? undefined,
                dateTo: dateRange.dateTo ?? undefined,
                zoneId: zoneFilter || undefined,
              })
            }
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />
        <div className="max-w-xs">
          <Select
            label="Zone"
            placeholder="ทุก Zone"
            options={(zones ?? []).map((z) => ({ value: z._id, label: z.name }))}
            value={zoneFilter}
            onChange={(event) => setZoneFilter(event.target.value)}
          />
        </div>
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row.ingredientId} isLoading={isLoading} emptyMessage="ไม่มีข้อมูล" />
    </div>
  )
}
