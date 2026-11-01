import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, ListChecks, Wallet, TrendingUp } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { StatCard } from '@/components/StatCard'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { LoadingState } from '@/components/LoadingState'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { formatCurrency, formatNumber, formatQuantity } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type {
  RequisitionReportIngredientRow,
  RequisitionReportUserRow,
  RequisitionReportZoneRow,
} from '@/types/entities'

export function RequisitionReportPage() {
  const canExport = usePermission(PERMISSIONS.REPORTS_EXPORT)
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'requisition', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      reportsApi.requisition({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const ingredientColumns: Array<DataTableColumn<RequisitionReportIngredientRow>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => row.ingredientName },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatNumber(row.quantity) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  const zoneColumns: Array<DataTableColumn<RequisitionReportZoneRow>> = [
    { key: 'zone', header: 'Zone', render: (row) => row.zoneName },
    { key: 'count', header: 'จำนวนใบเบิก', render: (row) => formatNumber(row.count) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  const userColumns: Array<DataTableColumn<RequisitionReportUserRow>> = [
    { key: 'user', header: 'ผู้เบิก', render: (row) => row.username },
    { key: 'count', header: 'จำนวนใบเบิก', render: (row) => formatNumber(row.count) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">รายงานใบเบิกสินค้า</h1>
          <p className="text-sm text-text-secondary">สรุปการเบิกสินค้าตามวัตถุดิบ Zone และผู้เบิก</p>
        </div>
        {canExport ? (
          <ExportButton
            onExport={(format) =>
              reportsApi.exportRequisition(format, {
                dateFrom: dateRange.dateFrom ?? undefined,
                dateTo: dateRange.dateTo ?? undefined,
              })
            }
          />
        ) : null}
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="จำนวนใบเบิก" value={`${formatNumber(data.numberOfRequests)} ใบ`} icon={ClipboardList} />
            <StatCard label="จำนวนรายการที่เบิก" value={`${formatNumber(data.requestedItems)} รายการ`} icon={ListChecks} />
            <StatCard label="มูลค่าที่เบิกรวม" value={formatCurrency(data.totalRequestedValue)} icon={Wallet} />
            <StatCard label="เฉลี่ยต่อวัน" value={`${formatNumber(data.averageRequestsPerDay)} ใบ/วัน`} icon={TrendingUp} />
          </div>

          <Card>
            <CardHeader>
              <span className="font-medium text-text-primary">วัตถุดิบที่เบิกมากที่สุด</span>
            </CardHeader>
            <CardBody>
              <DataTable
                columns={ingredientColumns}
                rows={data.topRequestedIngredients}
                rowKey={(row) => row.ingredientId}
                emptyMessage="ไม่มีข้อมูล"
              />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">การเบิกตาม Zone</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={zoneColumns} rows={data.requestsByZone} rowKey={(row) => row.zoneId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">การเบิกตามผู้ใช้งาน</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={userColumns} rows={data.requestsByUser} rowKey={(row) => row.userId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <span className="font-medium text-text-primary">แนวโน้มการเบิกรายวัน</span>
            </CardHeader>
            <CardBody>
              {data.trend.length === 0 ? (
                <p className="text-sm text-text-secondary">ไม่มีข้อมูล</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.trend.map((point) => (
                    <div key={point.date} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{point.date}</span>
                      <span className="font-medium text-text-primary">{formatQuantity(point.count, 'ใบ')}</span>
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
