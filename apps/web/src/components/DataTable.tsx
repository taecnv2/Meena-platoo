import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { LoadingState } from './LoadingState'
import { cn } from '@/utils/cn'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  isLoading?: boolean
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = 'ไม่มีข้อมูล', isLoading }: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState />
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-text-secondary">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-xl border border-border bg-white p-4">
            {columns.map((column) => (
              <div key={column.key} className="flex items-center justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0">
                <span className="shrink-0 text-text-secondary">{column.header}</span>
                <span className="text-right font-medium text-text-primary">{column.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
