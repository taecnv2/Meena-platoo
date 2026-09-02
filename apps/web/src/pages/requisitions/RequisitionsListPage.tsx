import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { requisitionsApi } from '@/api/endpoints/requisitions'
import { zonesApi } from '@/api/endpoints/zones'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { REQUISITION_STATUS_COLOR, REQUISITION_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { REQUISITION_STATUSES, type Requisition, type RequisitionStatus } from '@/types/entities'

export function RequisitionsListPage() {
  const canCreate = usePermission(PERMISSIONS.REQUISITION_CREATE)
  const canExport = usePermission(PERMISSIONS.REQUISITION_EXPORT)
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | ''>('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: requisitions, isLoading } = useQuery({
    queryKey: ['requisitions', statusFilter, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      requisitionsApi.list({
        status: statusFilter || undefined,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])

  const columns: Array<DataTableColumn<Requisition>> = [
    {
      key: 'code',
      header: 'เลขที่',
      render: (row) => (
        <Link to={`/requisitions/${row._id}`} className="font-medium text-primary hover:underline">
          {row.code}
        </Link>
      ),
    },
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'from', header: 'จาก', render: (row) => zoneMap.get(row.fromZoneId) ?? '-' },
    { key: 'to', header: 'ถึง', render: (row) => zoneMap.get(row.toZoneId) ?? '-' },
    { key: 'items', header: 'จำนวนรายการ', render: (row) => row.items.length },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => <Badge color={REQUISITION_STATUS_COLOR[row.status]}>{REQUISITION_STATUS_LABEL[row.status]}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">รายการใบเบิก</h1>
          <p className="text-sm text-text-secondary">ใบเบิกวัตถุดิบทั้งหมดที่คุณมีสิทธิ์เข้าถึง</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? (
            <ExportButton
              onExport={(format) =>
                requisitionsApi.exportFile(format, {
                  status: statusFilter || undefined,
                  dateFrom: dateRange.dateFrom ?? undefined,
                  dateTo: dateRange.dateTo ?? undefined,
                })
              }
            />
          ) : null}
          {canCreate ? (
            <Link to="/requisitions/new">
              <Button>
                <Plus className="size-4" /> สร้างใบเบิก
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="max-w-xs">
        <Select
          label="สถานะ"
          placeholder="ทุกสถานะ"
          options={REQUISITION_STATUSES.map((status) => ({ value: status, label: REQUISITION_STATUS_LABEL[status] }))}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as RequisitionStatus | '')}
        />
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <DataTable columns={columns} rows={requisitions ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีใบเบิกสินค้า" />
    </div>
  )
}
