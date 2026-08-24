import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2, ListChecks, Wallet, Clock } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { zonesApi } from '@/api/endpoints/zones'
import { StatCard } from '@/components/StatCard'
import { Select } from '@/components/Select'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { LoadingState } from '@/components/LoadingState'
import { WASTE_REASON_LABEL } from '@/constants/labels'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { WasteReportIngredientRow, WasteReportReasonRow, WasteReportZoneRow } from '@/types/entities'

export function WasteReportPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))
  const [zoneFilter, setZoneFilter] = useState('')

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'waste', dateRange.dateFrom, dateRange.dateTo, zoneFilter],
    queryFn: () =>
      reportsApi.waste({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
        zoneId: zoneFilter || undefined,
      }),
  })

  const reasonColumns: Array<DataTableColumn<WasteReportReasonRow>> = [
    { key: 'reason', header: 'สาเหตุ', render: (row) => WASTE_REASON_LABEL[row.reason] ?? row.reason },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatNumber(row.quantity) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  const zoneColumns: Array<DataTableColumn<WasteReportZoneRow>> = [
    { key: 'zone', header: 'Zone', render: (row) => row.zoneName },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatNumber(row.quantity) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  const ingredientColumns: Array<DataTableColumn<WasteReportIngredientRow>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => row.ingredientName },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatNumber(row.quantity) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">รายงานของเสีย</h1>
        <p className="text-sm text-text-secondary">สรุปของเสียที่อนุมัติแล้วตามสาเหตุ Zone และวัตถุดิบ</p>
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

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="จำนวนรายการของเสีย" value={`${formatNumber(data.totals.numberOfRecords)} รายการ`} icon={Trash2} />
            <StatCard label="ปริมาณของเสียรวม" value={formatNumber(data.totals.totalQuantity)} icon={ListChecks} />
            <StatCard label="มูลค่าของเสียรวม" value={formatCurrency(data.totals.totalValue)} icon={Wallet} tone="danger" />
            <StatCard label="รออนุมัติ" value={`${formatNumber(data.totals.pendingCount)} รายการ`} icon={Clock} tone="warning" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">ของเสียตามสาเหตุ</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={reasonColumns} rows={data.byReason} rowKey={(row) => row.reason} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">ของเสียตาม Zone</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={zoneColumns} rows={data.byZone} rowKey={(row) => row.zoneId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <span className="font-medium text-text-primary">วัตถุดิบที่เสียมากที่สุด</span>
            </CardHeader>
            <CardBody>
              <DataTable columns={ingredientColumns} rows={data.byIngredient} rowKey={(row) => row.ingredientId} emptyMessage="ไม่มีข้อมูล" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <span className="font-medium text-text-primary">แนวโน้มมูลค่าของเสียรายวัน</span>
            </CardHeader>
            <CardBody>
              {data.trend.length === 0 ? (
                <p className="text-sm text-text-secondary">ไม่มีข้อมูล</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.trend.map((point) => (
                    <div key={point.date} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{point.date}</span>
                      <span className="font-medium text-text-primary">{formatCurrency(point.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
