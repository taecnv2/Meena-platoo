import { useMemo, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, PlusCircle, RefreshCw, Warehouse } from 'lucide-react'
import { Badge, type BadgeColor } from '@/components/Badge'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { StatCard } from '@/components/StatCard'
import { formatNumber } from '@/utils/format'
import type { ImportResult, ImportRowAction, ImportRowResult } from '@/types/entities'

const ACTION_LABEL: Record<ImportRowAction, string> = {
  CREATE: 'สร้างใหม่',
  UPDATE: 'อัปเดต',
  ERROR: 'มีปัญหา',
}

const ACTION_COLOR: Record<ImportRowAction, BadgeColor> = {
  CREATE: 'success',
  UPDATE: 'info',
  ERROR: 'danger',
}

interface ImportResultViewProps {
  result: ImportResult
}

/** Summary cards + per-row table for an import preview (dry run) or the final import result. */
export function ImportResultView({ result }: ImportResultViewProps) {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)
  const { summary } = result

  const rows = useMemo(
    () => (showErrorsOnly ? result.rows.filter((row) => row.action === 'ERROR') : result.rows),
    [result.rows, showErrorsOnly],
  )

  const columns: Array<DataTableColumn<ImportRowResult>> = [
    { key: 'row', header: 'แถว', render: (row) => row.rowNumber },
    {
      key: 'code',
      header: 'รหัส',
      render: (row) =>
        row.code ?? <span className="text-text-secondary">{row.action === 'CREATE' ? 'สร้างอัตโนมัติ' : '-'}</span>,
    },
    { key: 'name', header: 'ชื่อ', render: (row) => row.name || '-' },
    {
      key: 'action',
      header: 'ผล',
      render: (row) => <Badge color={ACTION_COLOR[row.action]}>{ACTION_LABEL[row.action]}</Badge>,
    },
    {
      key: 'messages',
      header: 'รายละเอียด',
      render: (row) =>
        row.messages.length === 0 ? (
          <span className="text-text-secondary">-</span>
        ) : (
          <ul className={row.action === 'ERROR' ? 'flex flex-col gap-0.5 text-danger' : 'flex flex-col gap-0.5 text-text-secondary'}>
            {row.messages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="ทั้งหมด" value={`${formatNumber(summary.total)} แถว`} icon={FileSpreadsheet} />
        <StatCard label="สร้างใหม่" value={formatNumber(summary.create)} icon={PlusCircle} tone="success" />
        <StatCard label="อัปเดต" value={formatNumber(summary.update)} icon={RefreshCw} />
        <StatCard
          label="มีปัญหา"
          value={formatNumber(summary.error)}
          icon={AlertTriangle}
          tone={summary.error > 0 ? 'danger' : 'default'}
        />
        <StatCard label="ยอดยกมา" value={formatNumber(summary.openingBalances)} icon={Warehouse} tone="warning" />
      </div>

      {summary.newCategories.length > 0 || summary.newUnits.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-info bg-info-light px-4 py-3 text-sm text-sky-900">
          {summary.newCategories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">
                หมวดหมู่ใหม่{result.dryRun ? 'ที่จะสร้าง' : 'ที่สร้างแล้ว'}:
              </span>
              {summary.newCategories.map((name) => (
                <Badge key={name} color="gray">
                  {name}
                </Badge>
              ))}
            </div>
          ) : null}
          {summary.newUnits.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">หน่วยใหม่{result.dryRun ? 'ที่จะสร้าง' : 'ที่สร้างแล้ว'}:</span>
              {summary.newUnits.map((name) => (
                <Badge key={name} color="gray">
                  {name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="flex w-fit items-center gap-2 text-sm font-medium text-text-primary">
        <input
          type="checkbox"
          className="size-4 rounded border-border accent-primary"
          checked={showErrorsOnly}
          onChange={(event) => setShowErrorsOnly(event.target.checked)}
        />
        แสดงเฉพาะแถวที่มีปัญหา ({formatNumber(summary.error)})
      </label>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => String(row.rowNumber)}
        emptyMessage={showErrorsOnly ? 'ไม่มีแถวที่มีปัญหา' : 'ไม่มีข้อมูล'}
      />
    </div>
  )
}
