import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { PURCHASE_ORDER_STATUS_COLOR, PURCHASE_ORDER_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { PURCHASE_ORDER_STATUSES, type PurchaseOrder, type PurchaseOrderStatus } from '@/types/entities'

export function PurchaseOrdersListPage() {
  const canCreate = usePermission(PERMISSIONS.PURCHASING_CREATE)
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchasing', statusFilter, supplierFilter, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      purchasingApi.list({
        status: statusFilter || undefined,
        supplierId: supplierFilter || undefined,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s._id, s.name])), [suppliers])

  const columns: Array<DataTableColumn<PurchaseOrder>> = [
    {
      key: 'code',
      header: 'เลขที่',
      render: (row) => (
        <Link to={`/purchasing/${row._id}`} className="font-medium text-primary hover:underline">
          {row.code}
        </Link>
      ),
    },
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'supplier', header: 'Supplier', render: (row) => supplierMap.get(row.supplierId) ?? '-' },
    { key: 'items', header: 'จำนวนรายการ', render: (row) => row.items.length },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => <Badge color={PURCHASE_ORDER_STATUS_COLOR[row.status]}>{PURCHASE_ORDER_STATUS_LABEL[row.status]}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">รายการใบสั่งซื้อ</h1>
          <p className="text-sm text-text-secondary">ใบสั่งซื้อวัตถุดิบทั้งหมดจาก Supplier</p>
        </div>
        {canCreate ? (
          <Link to="/purchasing/new">
            <Button>
              <Plus className="size-4" /> สร้างใบสั่งซื้อ
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl">
        <Select
          label="สถานะ"
          placeholder="ทุกสถานะ"
          options={PURCHASE_ORDER_STATUSES.map((status) => ({ value: status, label: PURCHASE_ORDER_STATUS_LABEL[status] }))}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PurchaseOrderStatus | '')}
        />
        <Select
          label="Supplier"
          placeholder="ทุก Supplier"
          options={(suppliers ?? []).map((s) => ({ value: s._id, label: s.name }))}
          value={supplierFilter}
          onChange={(event) => setSupplierFilter(event.target.value)}
        />
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <DataTable
        columns={columns}
        rows={purchaseOrders ?? []}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="ยังไม่มีใบสั่งซื้อ"
      />
    </div>
  )
}
