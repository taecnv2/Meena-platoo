import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Printer, Receipt } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Card, CardBody } from '@/components/Card'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ExcelExportButton } from '@/components/ExcelExportButton'
import { LoadingState } from '@/components/LoadingState'
import { Select } from '@/components/Select'
import { formatDate } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { ExcelColumn } from '@/utils/excel'
import { SupplierStatementDocument } from './components/SupplierStatementDocument'
import { useUnitNameByCode } from './components/useUnitNameByCode'

/** A4 page setup while this page is mounted; AppLayout itself drops its fixed-height shell in print. */
const PRINT_STYLES = `
@media print {
  @page { size: A4; margin: 12mm; }
  html, body, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
}
`

interface ExportRow {
  no: number | null
  date: string
  code: string
  name: string
  quantity: number | null
  unit: string
  unitCost: number | null
  amount: number
  invoiceNo: string
  reference: string
  zone: string
}

const EXPORT_COLUMNS: Array<ExcelColumn<ExportRow>> = [
  { header: 'ลำดับ', value: (row) => row.no, width: 8 },
  { header: 'วันที่', value: (row) => row.date, width: 14 },
  { header: 'รหัส', value: (row) => row.code, width: 14 },
  { header: 'รายการ', value: (row) => row.name, width: 28 },
  { header: 'จำนวน', value: (row) => row.quantity, width: 10 },
  { header: 'หน่วย', value: (row) => row.unit, width: 10 },
  { header: 'ราคาต่อหน่วย', value: (row) => row.unitCost, width: 14 },
  { header: 'จำนวนเงิน', value: (row) => row.amount, width: 14 },
  { header: 'เลขที่บิล', value: (row) => row.invoiceNo, width: 16 },
  { header: 'อ้างอิง', value: (row) => row.reference, width: 16 },
  { header: 'รับเข้า Zone', value: (row) => row.zone, width: 16 },
]

export function SupplierStatementPage() {
  const [supplierId, setSupplierId] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))
  const unitName = useUnitNameByCode()

  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const statementQuery = useQuery({
    queryKey: ['reports', 'supplier-statement', supplierId, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      reportsApi.supplierStatement({
        supplierId,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
    enabled: Boolean(supplierId),
  })
  const statement = statementQuery.data

  const supplierOptions = useMemo(
    () =>
      [...(suppliersQuery.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'th'))
        .map((supplier) => ({ value: supplier._id, label: `${supplier.name} (${supplier.code})` })),
    [suppliersQuery.data],
  )

  const exportRows = useMemo<ExportRow[]>(() => {
    if (!statement || statement.lines.length === 0) {
      return []
    }
    const lines: ExportRow[] = statement.lines.map((line, index) => ({
      no: index + 1,
      date: formatDate(line.date),
      code: line.ingredientCode,
      name: line.ingredientName,
      quantity: line.quantity,
      unit: unitName(line.unit),
      unitCost: line.unitCost,
      amount: line.amount,
      invoiceNo: line.invoiceNo ?? '',
      reference: line.reference,
      zone: line.zoneName,
    }))
    const total: ExportRow = {
      no: null,
      date: '',
      code: '',
      name: 'รวมทั้งสิ้น',
      quantity: null,
      unit: '',
      unitCost: null,
      amount: statement.totalAmount,
      invoiceNo: '',
      reference: '',
      zone: '',
    }
    return [...lines, total]
  }, [statement, unitName])

  const hasLines = Boolean(statement && statement.lines.length > 0)
  const exportFileName = `ใบวางบิล_${statement?.supplier.name ?? 'supplier'}_${dateRange.dateFrom ?? 'ทั้งหมด'}_${dateRange.dateTo ?? ''}`

  return (
    <div className="flex flex-col gap-4">
      <style>{PRINT_STYLES}</style>

      <div className="flex flex-col gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">ใบวางบิล Supplier</h1>
          <p className="text-sm text-text-secondary">
            รวมรายการรับสินค้าจาก Supplier ในช่วงวันที่ที่เลือก ใช้ตรวจยอดกับบิลของ Supplier และพิมพ์เป็นใบวางบิล
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="lg:w-80">
            <Select
              id="statement-supplier"
              label="Supplier"
              placeholder={suppliersQuery.isLoading ? 'กำลังโหลด...' : 'เลือก Supplier'}
              options={supplierOptions}
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            />
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />
        </div>

        {hasLines ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> พิมพ์
            </Button>
            <ExcelExportButton fileName={exportFileName} columns={EXPORT_COLUMNS} rows={exportRows} />
          </div>
        ) : null}
      </div>

      {!supplierId ? (
        <Card>
          <CardBody>
            <EmptyState icon={Receipt} title="เลือก Supplier เพื่อดูใบวางบิล" description="ระบบจะรวมรายการรับสินค้าจาก Supplier นั้นในช่วงวันที่ที่เลือก" />
          </CardBody>
        </Card>
      ) : statementQuery.isLoading ? (
        <LoadingState />
      ) : statementQuery.isError ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={AlertCircle}
              title="โหลดใบวางบิลไม่สำเร็จ"
              description={getErrorMessage(statementQuery.error)}
              action={
                <Button variant="secondary" size="sm" onClick={() => void statementQuery.refetch()}>
                  ลองใหม่
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : statement && statement.lines.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Receipt}
              title="ไม่มีรายการรับสินค้าจาก Supplier นี้ในช่วงวันที่ที่เลือก"
              description="ลองเปลี่ยนช่วงวันที่ หรือตรวจสอบว่าบันทึกรับสินค้าโดยเลือก Supplier แล้ว"
            />
          </CardBody>
        </Card>
      ) : statement ? (
        <SupplierStatementDocument statement={statement} unitName={unitName} />
      ) : null}
    </div>
  )
}
