import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/endpoints/reports'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { ZoneReportRow } from '@/types/entities'

export function ZoneReportPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'zone', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      reportsApi.zone({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const columns: Array<DataTableColumn<ZoneReportRow>> = [
    { key: 'zone', header: 'Zone', render: (row) => row.zoneName },
    { key: 'stockQuantity', header: 'สต๊อกคงเหลือ', render: (row) => formatNumber(row.stockQuantity) },
    { key: 'stockValue', header: 'มูลค่าสต๊อก', render: (row) => formatCurrency(row.stockValue) },
    { key: 'usageValue', header: 'มูลค่าที่ใช้ไป', render: (row) => formatCurrency(row.usageValue) },
    { key: 'transfersIn', header: 'โอนเข้า', render: (row) => formatNumber(row.transfersIn) },
    { key: 'transfersOut', header: 'โอนออก', render: (row) => formatNumber(row.transfersOut) },
    { key: 'requisitionCount', header: 'จำนวนใบเบิก', render: (row) => formatNumber(row.requisitionCount) },
    { key: 'requisitionValue', header: 'มูลค่าใบเบิก', render: (row) => formatCurrency(row.requisitionValue) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">รายงานตาม Zone</h1>
        <p className="text-sm text-text-secondary">สต๊อก การใช้งาน การโอน และการเบิกสินค้าแยกตาม Zone</p>
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row.zoneId} isLoading={isLoading} emptyMessage="ไม่มีข้อมูล" />
    </div>
  )
}
