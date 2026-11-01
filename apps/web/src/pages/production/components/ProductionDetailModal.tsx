import type { ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'
import type { ProductionBatch, ProductionLine } from '@/types/entities'

interface ProductionDetailModalProps {
  batch: ProductionBatch | null
  zoneName: string
  ingredientName: (id: string) => string
  unitName: (code: string) => string
  onClose: () => void
}

/** "10 ถุง" plus "(= 1 กิโลกรัม)" when the line was keyed in a unit other than the base unit. */
function LineQuantity({ line, unitName }: { line: ProductionLine; unitName: (code: string) => string }) {
  const entered = `${formatNumber(line.inputQuantity)} ${unitName(line.inputUnit)}`
  if (line.inputUnit === line.unit) {
    return <>{entered}</>
  }
  return (
    <>
      {entered} <span className="text-text-secondary">(= {formatNumber(line.quantity)} {unitName(line.unit)})</span>
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className="text-right font-medium text-text-primary">{children}</dd>
    </div>
  )
}

export function ProductionDetailModal({ batch, zoneName, ingredientName, unitName, onClose }: ProductionDetailModalProps) {
  return (
    <Modal isOpen={batch !== null} onClose={onClose} title={batch ? `รายการแปรรูป ${batch.code}` : 'รายการแปรรูป'}>
      {batch ? (
        <div className="flex flex-col gap-4">
          <dl className="divide-y divide-border">
            <DetailRow label="วันที่">{formatDateTime(batch.createdAt)}</DetailRow>
            <DetailRow label="Zone">{zoneName}</DetailRow>
            <DetailRow label="Yield">{batch.yieldPercent !== null ? `${formatNumber(batch.yieldPercent)}%` : '-'}</DetailRow>
            <DetailRow label="ต้นทุนรวม">{formatCurrency(batch.totalCost)}</DetailRow>
          </dl>

          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">วัตถุดิบตั้งต้น (ตัดสต๊อก)</h3>
            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="font-medium text-text-primary">{ingredientName(String(batch.input.ingredientId))}</p>
              <p>
                <LineQuantity line={batch.input} unitName={unitName} />
              </p>
              <p className="text-text-secondary">
                ต้นทุน {formatCurrency(batch.input.unitCost)} / {unitName(batch.input.unit)} · รวม {formatCurrency(batch.input.totalCost)}
              </p>
              {batch.wasteQuantity !== null ? (
                <p className="text-text-secondary">
                  เศษ/เสีย {formatNumber(batch.wasteQuantity)} {unitName(batch.input.inputUnit)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">สินค้าที่ได้ (เพิ่มสต๊อก)</h3>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
              {batch.outputs.map((line) => {
                const enteredFactor = line.inputQuantity > 0 ? line.quantity / line.inputQuantity : 1
                return (
                  <li key={String(line.ingredientId)} className="flex flex-col gap-0.5 px-3 py-2">
                    <p className="font-medium text-text-primary">{ingredientName(String(line.ingredientId))}</p>
                    <p>
                      <LineQuantity line={line} unitName={unitName} />
                      {line.portionWeight !== null ? (
                        <span className="text-text-secondary"> · {formatNumber(line.portionWeight)} กรัม/{unitName(line.inputUnit)}</span>
                      ) : null}
                    </p>
                    <p className="text-text-secondary">
                      ต้นทุนต่อหน่วย{' '}
                      <strong className="text-text-primary">
                        {formatCurrency(line.unitCost * enteredFactor)} / {unitName(line.inputUnit)}
                      </strong>
                      {line.inputUnit !== line.unit ? ` (${formatCurrency(line.unitCost)} / ${unitName(line.unit)})` : ''}
                      {' · '}รวม {formatCurrency(line.totalCost)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>

          {batch.remark ? (
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">หมายเหตุ:</span> {batch.remark}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
