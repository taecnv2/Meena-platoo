import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogsApi } from '@/api/endpoints/auditLogs'
import { usersApi } from '@/api/endpoints/users'
import { Select } from '@/components/Select'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { AUDIT_ACTION_LABEL } from '@/constants/labels'
import { formatDateTime } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { AUDIT_ACTIONS, type AuditAction, type AuditLog } from '@/types/entities'

const AUDIT_ENTITIES = [
  'User',
  'Role',
  'Zone',
  'Ingredient',
  'Requisition',
  'Transfer',
  'ZoneStock',
  'PurchaseOrder',
  'Waste',
]

export function AuditLogListPage() {
  const canViewUsers = usePermission(PERMISSIONS.USERS_READ)
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: canViewUsers,
  })
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', entityFilter, actionFilter, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      auditLogsApi.list({
        entity: entityFilter || undefined,
        action: actionFilter || undefined,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u._id, u.username])), [users])

  const columns: Array<DataTableColumn<AuditLog>> = [
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'user', header: 'ผู้ใช้งาน', render: (row) => userMap.get(row.userId) ?? row.userId },
    { key: 'action', header: 'การกระทำ', render: (row) => AUDIT_ACTION_LABEL[row.action] },
    { key: 'entity', header: 'ประเภทข้อมูล', render: (row) => row.entity },
    { key: 'entityId', header: 'รหัสอ้างอิง', render: (row) => row.entityId ?? '-' },
    { key: 'remark', header: 'หมายเหตุ', render: (row) => row.remark ?? '-' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">ประวัติการใช้งาน</h1>
        <p className="text-sm text-text-secondary">บันทึกการกระทำสำคัญทั้งหมดในระบบ</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="ประเภทข้อมูล"
          placeholder="ทุกประเภท"
          options={AUDIT_ENTITIES.map((entity) => ({ value: entity, label: entity }))}
          value={entityFilter}
          onChange={(event) => setEntityFilter(event.target.value)}
        />
        <Select
          label="การกระทำ"
          placeholder="ทุกการกระทำ"
          options={AUDIT_ACTIONS.map((action) => ({ value: action, label: AUDIT_ACTION_LABEL[action] }))}
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value as AuditAction | '')}
        />
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <DataTable columns={columns} rows={auditLogs ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ไม่มีประวัติการใช้งาน" />
    </div>
  )
}
