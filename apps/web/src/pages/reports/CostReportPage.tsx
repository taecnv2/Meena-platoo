import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { zonesApi } from '@/api/endpoints/zones'
import { StatCard } from '@/components/StatCard'
import { Select } from '@/components/Select'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { LoadingState } from '@/components/LoadingState'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { MOVEMENT_TYPE_LABEL } from '@/constants/labels'
import { formatCurrency } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { CostReportIngredientRow, CostReportZoneRow, MovementType } from '@/types/entities'

export function CostReportPage() {
  const canExport = usePermission(PERMISSIONS.REPORTS_EXPORT)
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))
  const [zoneFilter, setZoneFilter] = useState('')

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'cost', dateRange.dateFrom, dateRange.dateTo, zoneFilter],
    queryFn: () =>
      reportsApi.cost({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
        zoneId: zoneFilter || undefined,
      }),
  })

  const ingredientColumns: Array<DataTableColumn<CostReportIngredientRow>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => row.ingredientName },
    { key: 'cost', header: 'ต้นทุนที่ใช้ไป', render: (row) => formatCurrency(row.cost) },
  ]

  const zoneColumns: Array<DataTableColumn<CostReportZoneRow>> = [
    { key: 'zone', header: 'Zone', render: (row) => row.zoneName },
    { key: 'cost', header: 'ต้นทุนที่ใช้ไป', render: (row) => formatCurrency(row.cost) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">รายงานต้นทุน</h1>
          <p className="text-sm text-text-secondary">
            ต้นทุนวัตถุดิบที่ใช้ไป (เบิกใช้ + ของเสีย + ปรับปรุงสต๊อกออก) แยกตามวัตถุดิบและ Zone
          </p>
        </div>
        {canExport ? (
          <ExportButton
            onExport={(format) =>
              reportsApi.exportCost(format, {
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

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="ต้นทุนรวม" value={formatCurrency(data.totalCost)} icon={Wallet} tone="danger" />
            {data.byMovementType.map((row) => (
              <StatCard
                key={row.movementType}
                label={MOVEMENT_TYPE_LABEL[row.movementType as MovementType] ?? row.movementType}
                value={formatCurrency(row.cost)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">ต้นทุนตามวัตถุดิบ</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={ingredientColumns} rows={data.byIngredient} rowKey={(row) => row.ingredientId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">ต้นทุนตาม Zone</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={zoneColumns} rows={data.byZone} rowKey={(row) => row.zoneId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <span className="font-medium text-text-primary">แนวโน้มต้นทุนรายวัน</span>
            </CardHeader>
            <CardBody>
              {data.trend.length === 0 ? (
                <p className="text-sm text-text-secondary">ไม่มีข้อมูล</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.trend.map((point) => (
                    <div key={point.date} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{point.date}</span>
                      <span className="font-medium text-text-primary">{formatCurrency(point.cost)}</span>
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
