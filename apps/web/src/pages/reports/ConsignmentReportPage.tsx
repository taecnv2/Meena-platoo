import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, Info, Wine } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ExportButton } from '@/components/ExportButton'
import { LoadingState } from '@/components/LoadingState'
import { Select } from '@/components/Select'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { ExcelColumn } from '@/utils/excel'
import type { ConsignmentItemRow } from '@/types/entities'
import { useUnitNameByCode } from './components/useUnitNameByCode'

type ExportRow = ConsignmentItemRow & { owner: string }

const quantityCell = (value: number) => (value === 0 ? '-' : formatNumber(value))

export function ConsignmentReportPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))
  const [owner, setOwner] = useState('')
  const unitName = useUnitNameByCode()

  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const reportQuery = useQuery({
    queryKey: ['reports', 'consignment', dateRange.dateFrom, dateRange.dateTo, owner],
    queryFn: () =>
      reportsApi.consignment({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
        owner: owner || undefined,
      }),
  })
  const reports = useMemo(() => reportQuery.data ?? [], [reportQuery.data])

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>()
    for (const ingredient of ingredients ?? []) {
      const name = ingredient.consignmentOwner?.trim()
      if (name) {
        owners.add(name)
      }
    }
    return [...owners].sort((a, b) => a.localeCompare(b, 'th')).map((name) => ({ value: name, label: name }))
  }, [ingredients])

  const columns: Array<DataTableColumn<ConsignmentItemRow>> = [
    {
      key: 'name',
      header: 'รายการ',
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-text-primary">{row.name}</span>
          <span className="text-xs text-text-secondary">
            {row.code} · {unitName(row.unit)}
          </span>
        </span>
      ),
    },
    { key: 'opening', header: 'ยกมา', render: (row) => quantityCell(row.opening), className: 'tabular-nums' },
    { key: 'received', header: 'รับเข้า', render: (row) => quantityCell(row.received), className: 'tabular-nums' },
    { key: 'sold', header: 'ขายออก', render: (row) => quantityCell(row.sold), className: 'tabular-nums' },
    { key: 'soldValue', header: 'มูลค่าขาย (ราคาทุน)', render: (row) => formatCurrency(row.soldValue), className: 'tabular-nums' },
    { key: 'otherOut', header: 'ออกอื่นๆ', render: (row) => quantityCell(row.otherOut), className: 'tabular-nums' },
    {
      key: 'balance',
      header: 'คงเหลือ',
      render: (row) => <span className="font-semibold">{formatNumber(row.balance)}</span>,
      className: 'tabular-nums',
    },
    { key: 'balanceValue', header: 'มูลค่าคงเหลือ', render: (row) => formatCurrency(row.balanceValue), className: 'tabular-nums' },
  ]

  const exportRows = useMemo<ExportRow[]>(
    () => reports.flatMap((report) => report.items.map((item) => ({ ...item, owner: report.owner }))),
    [reports],
  )
  const exportColumns: Array<ExcelColumn<ExportRow>> = [
    { header: 'เจ้าของสินค้า', value: (row) => row.owner, width: 20 },
    { header: 'รหัส', value: (row) => row.code, width: 14 },
    { header: 'รายการ', value: (row) => row.name, width: 28 },
    { header: 'หน่วย', value: (row) => unitName(row.unit), width: 10 },
    { header: 'ยกมา', value: (row) => row.opening, width: 10 },
    { header: 'รับเข้า', value: (row) => row.received, width: 10 },
    { header: 'ขายออก', value: (row) => row.sold, width: 10 },
    { header: 'มูลค่าขาย (ราคาทุน)', value: (row) => row.soldValue, width: 18 },
    { header: 'ออกอื่นๆ', value: (row) => row.otherOut, width: 10 },
    { header: 'คงเหลือ', value: (row) => row.balance, width: 10 },
    { header: 'มูลค่าคงเหลือ', value: (row) => row.balanceValue, width: 16 },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">สินค้าฝากขาย</h1>
        <p className="text-sm text-text-secondary">สรุปรับเข้า ขายออก และคงเหลือของสินค้าฝากขาย แยกตามเจ้าของสินค้า</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-info bg-info-light px-4 py-3 text-sm text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <ul className="flex flex-col gap-0.5">
          <li>
            บันทึกการขายด้วยหน้า{' '}
            <Link to="/inventory/stock-out" className="font-medium underline">
              จ่ายสินค้า
            </Link>{' '}
            เลือกเหตุผล "ขาย"
          </li>
          <li>
            ตั้งเจ้าของสินค้าได้ที่หน้า{' '}
            <Link to="/master-data/ingredients" className="font-medium underline">
              วัตถุดิบ
            </Link>
          </li>
          <li>คงเหลือ คือยอดปัจจุบันรวมทุก Zone (ไม่ขึ้นกับช่วงวันที่) · มูลค่าคิดจากต้นทุนมาตรฐานของสินค้า</li>
        </ul>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />
        <div className="sm:w-64">
          <Select
            id="consignment-owner"
            label="เจ้าของสินค้า"
            placeholder="ทุกเจ้าของ"
            options={ownerOptions}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
        </div>
        <div className="sm:ml-auto">
          <ExportButton fileName={`สินค้าฝากขาย_${dateRange.dateFrom ?? 'ทั้งหมด'}_${dateRange.dateTo ?? ''}`} columns={exportColumns} rows={exportRows} />
        </div>
      </div>

      {reportQuery.isLoading ? (
        <LoadingState />
      ) : reportQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="โหลดรายงานไม่สำเร็จ"
          description={getErrorMessage(reportQuery.error)}
          action={
            <Button variant="secondary" size="sm" onClick={() => void reportQuery.refetch()}>
              ลองใหม่
            </Button>
          }
        />
      ) : reports.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Wine}
              title="ยังไม่มีสินค้าฝากขาย"
              description='ตั้ง "เจ้าของสินค้าฝากขาย" ให้วัตถุดิบที่หน้า วัตถุดิบ แล้วรายการจะแสดงที่นี่'
            />
          </CardBody>
        </Card>
      ) : (
        reports.map((report) => (
          <Card key={report.owner}>
            <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-text-primary">{report.owner}</h2>
              <span className="text-sm text-text-secondary">{formatNumber(report.items.length)} รายการ</span>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <DataTable columns={columns} rows={report.items} rowKey={(row) => row.ingredientId} emptyMessage="ไม่มีรายการ" />
              <dl className="flex flex-col gap-1 border-t border-border pt-3 text-sm sm:flex-row sm:justify-end sm:gap-8">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-text-secondary">รวมมูลค่าขาย (ราคาทุน)</dt>
                  <dd className="font-semibold text-text-primary sm:text-right">{formatCurrency(report.totalSoldValue)}</dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-text-secondary">รวมมูลค่าคงเหลือ</dt>
                  <dd className="font-semibold text-text-primary sm:text-right">{formatCurrency(report.totalBalanceValue)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  )
}
