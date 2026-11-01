import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Search } from 'lucide-react'
import { reportsApi } from '@/api/endpoints/reports'
import { categoriesApi } from '@/api/endpoints/categories'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ExportButton } from '@/components/ExportButton'
import { Input } from '@/components/Input'
import { LoadingState } from '@/components/LoadingState'
import { Select } from '@/components/Select'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import type { ExcelColumn } from '@/utils/excel'
import type { LedgerRow } from '@/types/entities'
import { LedgerDailyTable } from './components/LedgerDailyTable'
import { countDays, formatDayShort, MAX_LEDGER_DAYS } from './components/ledgerDays'
import { useUnitNameByCode } from './components/useUnitNameByCode'

type ViewMode = 'summary' | 'daily'

function defaultRange(): DateRangeValue {
  return { dateFrom: getPresetRange('thisMonth').dateFrom, dateTo: getPresetRange('today').dateTo }
}

function validateRange({ dateFrom, dateTo }: DateRangeValue): string | null {
  if (!dateFrom || !dateTo) {
    return 'กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด'
  }
  if (dateFrom > dateTo) {
    return 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'
  }
  const days = countDays(dateFrom, dateTo)
  if (days > MAX_LEDGER_DAYS) {
    return `เลือกช่วงวันที่ได้ไม่เกิน ${MAX_LEDGER_DAYS} วัน (ตอนนี้เลือกไว้ ${formatNumber(days)} วัน)`
  }
  return null
}

export function LedgerReportPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(defaultRange)
  const [zoneId, setZoneId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>('summary')
  const unitName = useUnitNameByCode()

  const rangeError = validateRange(dateRange)

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const ledgerQuery = useQuery({
    queryKey: ['reports', 'ledger', dateRange.dateFrom, dateRange.dateTo, zoneId, categoryId],
    queryFn: () =>
      reportsApi.ledger({
        dateFrom: dateRange.dateFrom ?? '',
        dateTo: dateRange.dateTo ?? '',
        zoneId: zoneId || undefined,
        categoryId: categoryId || undefined,
      }),
    enabled: rangeError === null,
  })
  const report = ledgerQuery.data

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const all = report?.rows ?? []
    if (!term) {
      return all
    }
    return all.filter((row) => row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term))
  }, [report, search])

  const zoneLabel = zoneId ? ((zones ?? []).find((zone) => zone._id === zoneId)?.name ?? '') : 'ทุก Zone'

  const summaryColumns: Array<DataTableColumn<LedgerRow>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    { key: 'name', header: 'วัตถุดิบ', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'category', header: 'หมวดหมู่', render: (row) => row.categoryName },
    { key: 'unit', header: 'หน่วย', render: (row) => unitName(row.unit) },
    { key: 'opening', header: 'ยอดยกมา', render: (row) => formatNumber(row.opening), className: 'tabular-nums' },
    {
      key: 'in',
      header: 'รับเข้า',
      render: (row) => (row.totalIn === 0 ? '-' : formatNumber(row.totalIn)),
      className: 'tabular-nums text-success',
    },
    {
      key: 'out',
      header: 'เบิกออก',
      render: (row) => (row.totalOut === 0 ? '-' : formatNumber(row.totalOut)),
      className: 'tabular-nums text-danger',
    },
    {
      key: 'closing',
      header: 'คงเหลือ',
      render: (row) => (
        <span className={cn('font-semibold', row.closing < 0 ? 'text-danger' : 'text-text-primary')}>{formatNumber(row.closing)}</span>
      ),
      className: 'tabular-nums',
    },
  ]

  const baseExportColumns: Array<ExcelColumn<LedgerRow>> = [
    { header: 'รหัส', value: (row) => row.code },
    { header: 'วัตถุดิบ', value: (row) => row.name, width: 28 },
    { header: 'หมวดหมู่', value: (row) => row.categoryName },
    { header: 'หน่วย', value: (row) => unitName(row.unit), width: 12 },
    { header: 'ยอดยกมา', value: (row) => row.opening, width: 12 },
  ]
  const totalExportColumns: Array<ExcelColumn<LedgerRow>> = [
    { header: 'รับเข้า', value: (row) => row.totalIn, width: 12 },
    { header: 'เบิกออก', value: (row) => row.totalOut, width: 12 },
    { header: 'คงเหลือ', value: (row) => row.closing, width: 12 },
  ]
  const dailyExportColumns: Array<ExcelColumn<LedgerRow>> = (report?.days ?? []).flatMap((day, index) => {
    const label = formatDayShort(day)
    return [
      { header: `${label} รับ`, value: (row: LedgerRow) => row.days[index]?.in ?? 0, width: 10 },
      { header: `${label} เบิก`, value: (row: LedgerRow) => row.days[index]?.out ?? 0, width: 10 },
      { header: `${label} คงเหลือ`, value: (row: LedgerRow) => row.days[index]?.closing ?? 0, width: 11 },
    ]
  })
  const exportColumns =
    view === 'daily'
      ? [...baseExportColumns, ...dailyExportColumns, ...totalExportColumns]
      : [...baseExportColumns, ...totalExportColumns]
  const exportFileName = `สต๊อกรายวัน_${zoneLabel || 'Zone'}_${dateRange.dateFrom ?? ''}_${dateRange.dateTo ?? ''}${view === 'daily' ? '_แยกรายวัน' : ''}`

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">สต๊อกรายวัน</h1>
        <p className="text-sm text-text-secondary">ยอดยกมา / รับเข้า / เบิกออก / คงเหลือ ของแต่ละวัตถุดิบ เหมือนชีตสต๊อกเดิม (หน่วยหลักของวัตถุดิบ)</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-[28rem]">
          <Select
            id="ledger-zone"
            label="Zone"
            placeholder="ทุก Zone"
            options={(zones ?? []).map((zone) => ({ value: zone._id, label: zone.name }))}
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
          />
          <Select
            id="ledger-category"
            label="หมวดหมู่"
            placeholder="ทุกหมวดหมู่"
            options={(categories ?? []).map((category) => ({ value: category._id, label: category.name }))}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          />
        </div>
      </div>

      {rangeError ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-red-800">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {rangeError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-text-secondary" aria-hidden />
          <Input
            id="ledger-search"
            label="ค้นหา"
            type="search"
            placeholder="ชื่อหรือรหัสวัตถุดิบ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="รูปแบบการแสดงผล" className="inline-flex rounded-lg border border-border bg-white p-1">
            {(
              [
                { value: 'summary', label: 'สรุปทั้งช่วง' },
                { value: 'daily', label: 'แสดงแยกรายวัน' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                onClick={() => setView(option.value)}
                className={cn(
                  'h-9 rounded-md px-3 text-sm font-medium transition-colors',
                  view === option.value ? 'bg-primary text-white' : 'text-text-secondary hover:bg-slate-100',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ExportButton fileName={exportFileName} columns={exportColumns} rows={rows} />
        </div>
      </div>

      {rangeError ? null : ledgerQuery.isLoading ? (
        <LoadingState />
      ) : ledgerQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="โหลดรายงานไม่สำเร็จ"
          description={getErrorMessage(ledgerQuery.error)}
          action={
            <Button variant="secondary" size="sm" onClick={() => void ledgerQuery.refetch()}>
              ลองใหม่
            </Button>
          }
        />
      ) : report ? (
        rows.length === 0 ? (
          <EmptyState
            title={search ? 'ไม่พบวัตถุดิบที่ค้นหา' : 'ไม่มีสต๊อกหรือความเคลื่อนไหวในช่วงนี้'}
            description={search ? 'ลองค้นหาด้วยคำอื่น' : 'ลองเปลี่ยนช่วงวันที่ Zone หรือหมวดหมู่'}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-secondary">
              {zoneLabel} · {formatNumber(rows.length)} รายการ · {formatNumber(report.days.length)} วัน
            </p>
            {view === 'daily' ? (
              <LedgerDailyTable days={report.days} rows={rows} unitName={unitName} />
            ) : (
              <DataTable columns={summaryColumns} rows={rows} rowKey={(row) => row.ingredientId} />
            )}
          </div>
        )
      ) : null}

      {!rangeError ? (
        <div className="flex flex-col gap-1 text-xs text-text-secondary">
          {zoneId ? (
            <p>รับเข้า = รับสินค้า + โอนเข้า + ปรับเพิ่ม + ได้จากการแปรรูป · เบิกออก = จ่ายออก + โอนออก + ปรับลด + ของเสีย + ใช้แปรรูป + ตัดอัตโนมัติ</p>
          ) : (
            <p>
              เมื่อเลือก "ทุก Zone" จะไม่นับการโอนระหว่าง Zone (เพราะโอนออกจาก Zone หนึ่งและรับเข้าอีก Zone หักล้างกันพอดี)
            </p>
          )}
          <p>แสดงเฉพาะวัตถุดิบที่มีสต๊อก หรือมีการเคลื่อนไหวในช่วงวันที่ที่เลือก</p>
        </div>
      ) : null}
    </div>
  )
}
