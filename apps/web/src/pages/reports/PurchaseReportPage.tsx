import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, PackageCheck, Wallet } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { StatCard } from '@/components/StatCard'
import { Select } from '@/components/Select'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { LoadingState } from '@/components/LoadingState'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { PurchaseReportIngredientRow, PurchaseReportSupplierRow } from '@/types/entities'

export function PurchaseReportPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))
  const [supplierFilter, setSupplierFilter] = useState('')

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'purchase', dateRange.dateFrom, dateRange.dateTo, supplierFilter],
    queryFn: () =>
      reportsApi.purchase({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
        supplierId: supplierFilter || undefined,
      }),
  })

  const supplierColumns: Array<DataTableColumn<PurchaseReportSupplierRow>> = [
    { key: 'supplier', header: 'Supplier', render: (row) => row.supplierName },
    { key: 'count', header: 'จำนวนใบสั่งซื้อ', render: (row) => formatNumber(row.count) },
    { key: 'value', header: 'มูลค่าสั่งซื้อ', render: (row) => formatCurrency(row.value) },
  ]

  const ingredientColumns: Array<DataTableColumn<PurchaseReportIngredientRow>> = [
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => row.ingredientName },
    { key: 'quantity', header: 'จำนวนสั่งซื้อ', render: (row) => formatNumber(row.quantity) },
    { key: 'value', header: 'มูลค่า', render: (row) => formatCurrency(row.value) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">รายงานจัดซื้อ</h1>
        <p className="text-sm text-text-secondary">สรุปการสั่งซื้อและรับสินค้าตาม Supplier และวัตถุดิบ</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />
        <div className="max-w-xs">
          <Select
            label="Supplier"
            placeholder="ทุก Supplier"
            options={(suppliers ?? []).map((s) => ({ value: s._id, label: s.name }))}
            value={supplierFilter}
            onChange={(event) => setSupplierFilter(event.target.value)}
          />
        </div>
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="จำนวนใบสั่งซื้อ" value={`${formatNumber(data.totals.numberOfOrders)} ใบ`} icon={ShoppingCart} />
            <StatCard label="มูลค่าสั่งซื้อรวม" value={formatCurrency(data.totals.totalOrderedValue)} icon={Wallet} />
            <StatCard label="มูลค่าที่รับแล้ว" value={formatCurrency(data.totals.totalReceivedValue)} icon={PackageCheck} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">การสั่งซื้อตาม Supplier</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={supplierColumns} rows={data.bySupplier} rowKey={(row) => row.supplierId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <span className="font-medium text-text-primary">วัตถุดิบที่สั่งซื้อมากที่สุด</span>
              </CardHeader>
              <CardBody>
                <DataTable columns={ingredientColumns} rows={data.byIngredient} rowKey={(row) => row.ingredientId} emptyMessage="ไม่มีข้อมูล" />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <span className="font-medium text-text-primary">แนวโน้มมูลค่าการรับสินค้ารายวัน</span>
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
