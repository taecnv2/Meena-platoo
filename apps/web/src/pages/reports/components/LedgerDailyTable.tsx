import { Fragment } from 'react'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import type { LedgerRow } from '@/types/entities'
import { formatDayHeader, formatWeekday } from './ledgerDays'

interface LedgerDailyTableProps {
  days: string[]
  rows: LedgerRow[]
  unitName: (code: string) => string
}

const cellBase = 'border-b border-border px-2 py-2 text-right tabular-nums whitespace-nowrap'
const groupStart = 'border-l border-border'

function Flow({ value }: { value: number }) {
  return value === 0 ? <span className="text-slate-300">-</span> : <>{formatNumber(value)}</>
}

function Closing({ value }: { value: number }) {
  return <span className={cn('font-medium', value < 0 ? 'text-danger' : 'text-text-primary')}>{formatNumber(value)}</span>
}

/**
 * Spreadsheet-style wide ledger: one sticky ingredient column, then per day a รับ / เบิก / คงเหลือ
 * group. Scrolls horizontally (and vertically with a sticky header) so it stays usable on phones.
 */
export function LedgerDailyTable({ days, rows, unitName }: LedgerDailyTableProps) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-white" tabIndex={0} aria-label="ตารางสต๊อกแยกรายวัน เลื่อนซ้ายขวาเพื่อดูวันอื่น">
      <table className="min-w-max border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20 bg-slate-50 text-text-secondary">
          <tr>
            <th
              scope="col"
              rowSpan={2}
              className="sticky left-0 z-30 w-36 min-w-36 border-b border-r border-border bg-slate-50 px-3 py-2 text-left font-medium sm:w-56 sm:min-w-56"
            >
              วัตถุดิบ
            </th>
            <th scope="col" rowSpan={2} className="border-b border-border px-2 py-2 text-right font-medium">
              ยอดยกมา
            </th>
            {days.map((day, index) => (
              <th
                key={day}
                scope="colgroup"
                colSpan={3}
                className={cn('border-b border-border px-2 py-1.5 text-center font-semibold text-text-primary', groupStart, index % 2 === 1 && 'bg-slate-100')}
              >
                {formatDayHeader(day)} <span className="font-normal text-text-secondary">({formatWeekday(day)})</span>
              </th>
            ))}
            <th scope="colgroup" colSpan={3} className={cn('border-b border-border bg-primary-light px-2 py-1.5 text-center font-semibold text-primary', groupStart)}>
              รวมทั้งช่วง
            </th>
          </tr>
          <tr>
            {days.map((day, index) => (
              <Fragment key={day}>
                <th scope="col" className={cn('border-b border-border px-2 py-1 text-right text-xs font-medium', groupStart, index % 2 === 1 && 'bg-slate-100')}>
                  รับ
                </th>
                <th scope="col" className={cn('border-b border-border px-2 py-1 text-right text-xs font-medium', index % 2 === 1 && 'bg-slate-100')}>
                  เบิก
                </th>
                <th scope="col" className={cn('border-b border-border px-2 py-1 text-right text-xs font-medium', index % 2 === 1 && 'bg-slate-100')}>
                  คงเหลือ
                </th>
              </Fragment>
            ))}
            <th scope="col" className={cn('border-b border-border bg-primary-light px-2 py-1 text-right text-xs font-medium', groupStart)}>
              รับเข้า
            </th>
            <th scope="col" className="border-b border-border bg-primary-light px-2 py-1 text-right text-xs font-medium">
              เบิกออก
            </th>
            <th scope="col" className="border-b border-border bg-primary-light px-2 py-1 text-right text-xs font-medium">
              คงเหลือ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ingredientId} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 w-36 min-w-36 border-b border-r border-border bg-white px-3 py-2 text-left font-normal group-hover:bg-slate-50 sm:w-56 sm:min-w-56"
              >
                <span className="block font-medium text-text-primary">{row.name}</span>
                <span className="block text-xs text-text-secondary">
                  {row.code} · {unitName(row.unit)}
                </span>
              </th>
              <td className={cn(cellBase, 'group-hover:bg-slate-50')}>{formatNumber(row.opening)}</td>
              {row.days.map((day, index) => {
                const shade = index % 2 === 1 ? 'bg-slate-50/70' : ''
                return (
                  <Fragment key={days[index] ?? index}>
                    <td className={cn(cellBase, groupStart, shade, 'text-success')}>
                      <Flow value={day.in} />
                    </td>
                    <td className={cn(cellBase, shade, 'text-danger')}>
                      <Flow value={day.out} />
                    </td>
                    <td className={cn(cellBase, shade)}>
                      <Closing value={day.closing} />
                    </td>
                  </Fragment>
                )
              })}
              <td className={cn(cellBase, groupStart, 'bg-primary-light/40 text-success')}>
                <Flow value={row.totalIn} />
              </td>
              <td className={cn(cellBase, 'bg-primary-light/40 text-danger')}>
                <Flow value={row.totalOut} />
              </td>
              <td className={cn(cellBase, 'bg-primary-light/40')}>
                <Closing value={row.closing} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
