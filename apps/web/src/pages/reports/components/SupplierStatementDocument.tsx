import type { ReactNode } from 'react'
import { formatCurrency, formatDate, formatNumber } from '@/utils/format'
import type { SupplierStatement } from '@/types/entities'

const RESTAURANT_DISPLAY_NAME = 'ร้านมีนาปลาทู (Meena Platoo)'

/** 'YYYY-MM-DD' parsed as a local date, so the Thai date shown matches the picked day. */
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return formatDate(new Date(year, month - 1, day))
}

function formatStatementPeriod(dateFrom: string | null, dateTo: string | null): string {
  if (dateFrom && dateTo) {
    return `${formatDateOnly(dateFrom)} - ${formatDateOnly(dateTo)}`
  }
  if (dateFrom) {
    return `ตั้งแต่ ${formatDateOnly(dateFrom)}`
  }
  if (dateTo) {
    return `ถึง ${formatDateOnly(dateTo)}`
  }
  return 'ทุกช่วงเวลา'
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm">
      <span className="text-text-secondary">{label}: </span>
      <span className="text-text-primary">{children || '-'}</span>
    </p>
  )
}

const th = 'border-b-2 border-slate-300 px-2 py-2 font-semibold text-text-primary'
const td = 'border-b border-border px-2 py-1.5 align-top'

interface SupplierStatementDocumentProps {
  statement: SupplierStatement
  unitName: (code: string) => string
}

/** The printable ใบวางบิล itself: header, parties, line table, grand total and signature lines. */
export function SupplierStatementDocument({ statement, unitName }: SupplierStatementDocumentProps) {
  const { supplier } = statement
  return (
    <article
      aria-label="ใบวางบิล"
      className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between print:flex-row">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">ใบวางบิล</h2>
          <p className="text-sm text-text-secondary">รายการรับสินค้าจาก Supplier</p>
        </div>
        <div className="text-sm sm:text-right print:text-right">
          <p>
            <span className="text-text-secondary">ช่วงวันที่: </span>
            <span className="font-medium text-text-primary">{formatStatementPeriod(statement.dateFrom, statement.dateTo)}</span>
          </p>
          <p>
            <span className="text-text-secondary">วันที่ออกเอกสาร: </span>
            <span className="text-text-primary">{formatDate(new Date())}</span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 print:grid-cols-2">
        <section className="flex flex-col gap-0.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">ร้าน</h3>
          <p className="font-semibold text-text-primary">{RESTAURANT_DISPLAY_NAME}</p>
        </section>
        <section className="flex flex-col gap-0.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Supplier</h3>
          <p className="font-semibold text-text-primary">
            {supplier.name} <span className="font-normal text-text-secondary">({supplier.code})</span>
          </p>
          <Field label="ผู้ติดต่อ">{supplier.contactName}</Field>
          <Field label="โทร">{supplier.phone}</Field>
          <Field label="ที่อยู่">{supplier.address}</Field>
        </section>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[760px] border-collapse text-sm print:min-w-0 print:text-xs">
          <thead>
            <tr className="text-left">
              <th scope="col" className={`${th} w-12 text-center`}>
                ลำดับ
              </th>
              <th scope="col" className={th}>
                วันที่
              </th>
              <th scope="col" className={th}>
                รายการ
              </th>
              <th scope="col" className={`${th} text-right`}>
                จำนวน
              </th>
              <th scope="col" className={th}>
                หน่วย
              </th>
              <th scope="col" className={`${th} text-right`}>
                ราคาต่อหน่วย
              </th>
              <th scope="col" className={`${th} text-right`}>
                จำนวนเงิน
              </th>
              <th scope="col" className={th}>
                เลขที่บิล
              </th>
              <th scope="col" className={th}>
                อ้างอิง
              </th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line, index) => (
              <tr key={index} className="break-inside-avoid">
                <td className={`${td} text-center tabular-nums`}>{index + 1}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(line.date)}</td>
                <td className={td}>
                  <span className="text-text-primary">{line.ingredientName}</span>
                  <span className="block text-xs text-text-secondary">{line.ingredientCode}</span>
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatNumber(line.quantity)}</td>
                <td className={td}>{unitName(line.unit)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatNumber(line.unitCost)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatNumber(line.amount)}</td>
                <td className={td}>{line.invoiceNo ?? '-'}</td>
                <td className={td}>{line.reference}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={6} className="border-t-2 border-slate-300 px-2 py-3 text-right text-base font-bold text-text-primary">
                รวมทั้งสิ้น
              </th>
              <td className="border-t-2 border-slate-300 px-2 py-3 text-right text-base font-bold tabular-nums text-text-primary">
                {formatCurrency(statement.totalAmount)}
              </td>
              <td colSpan={2} className="border-t-2 border-slate-300 px-2 py-3 text-sm text-text-secondary">
                {formatNumber(statement.lines.length)} รายการ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 print:mt-16 print:grid-cols-2 print:break-inside-avoid">
        {['ผู้วางบิล', 'ผู้รับวางบิล'].map((role) => (
          <div key={role} className="flex flex-col items-center gap-2 text-sm text-text-primary">
            <span className="w-full max-w-64 border-b border-dotted border-slate-500 pb-6" aria-hidden />
            <span>( ........................................ )</span>
            <span className="font-medium">{role}</span>
            <span className="text-text-secondary">วันที่ ......../......../........</span>
          </div>
        ))}
      </div>
    </article>
  )
}
