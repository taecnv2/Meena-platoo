import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { productionApi } from '@/api/endpoints/production'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Card, CardBody } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ExportButton } from '@/components/ExportButton'
import { LoadingState } from '@/components/LoadingState'
import { usePermission } from '@/hooks/usePermission'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { PERMISSIONS } from '@/constants/permissions'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import type { ExcelColumn } from '@/utils/excel'
import type { ProductionBatch } from '@/types/entities'
import { ProductionForm } from './components/ProductionForm'
import { ProductionDetailModal } from './components/ProductionDetailModal'

export function ProductionPage() {
  const canCreate = usePermission(PERMISSIONS.PRODUCTION_CREATE)
  const accessibleZoneIds = useAccessibleZoneIds()
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const ingredientsQuery = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })
  const batchesQuery = useQuery({
    queryKey: ['production', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      productionApi.list({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const zoneMap = useMemo(() => new Map((zonesQuery.data ?? []).map((zone) => [zone._id, zone.name])), [zonesQuery.data])
  const ingredientMap = useMemo(
    () => new Map((ingredientsQuery.data ?? []).map((ingredient) => [ingredient._id, ingredient.name])),
    [ingredientsQuery.data],
  )
  const unitNameByCode = useMemo(() => new Map((unitsQuery.data ?? []).map((unit) => [unit.code, unit.name])), [unitsQuery.data])

  const formZones = useMemo(
    () =>
      (zonesQuery.data ?? []).filter(
        (zone) => zone.status === 'ACTIVE' && (!accessibleZoneIds || accessibleZoneIds.includes(zone._id)),
      ),
    [zonesQuery.data, accessibleZoneIds],
  )

  const ingredientName = (id: string) => ingredientMap.get(id) ?? '-'
  const unitName = (code: string) => unitNameByCode.get(code) ?? code
  const zoneName = (id: string) => zoneMap.get(String(id)) ?? '-'
  const describeOutputs = (batch: ProductionBatch) =>
    batch.outputs
      .map((line) => `${ingredientName(String(line.ingredientId))} ${formatNumber(line.inputQuantity)} ${unitName(line.inputUnit)}`)
      .join(', ')

  const batches = batchesQuery.data ?? []
  const selectedBatch = batches.find((batch) => batch._id === selectedId) ?? null

  const columns: Array<DataTableColumn<ProductionBatch>> = [
    { key: 'code', header: 'เลขที่', render: (row) => <span className="font-medium">{row.code}</span> },
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'zone', header: 'Zone', render: (row) => zoneName(row.zoneId) },
    {
      key: 'input',
      header: 'วัตถุดิบตั้งต้น',
      render: (row) =>
        `${ingredientName(String(row.input.ingredientId))} (${formatNumber(row.input.inputQuantity)} ${unitName(row.input.inputUnit)})`,
    },
    { key: 'outputs', header: 'ได้', render: (row) => describeOutputs(row) },
    { key: 'yield', header: 'Yield %', render: (row) => (row.yieldPercent !== null ? `${formatNumber(row.yieldPercent)}%` : '-') },
    { key: 'cost', header: 'ต้นทุนรวม', render: (row) => formatCurrency(row.totalCost) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedId(row._id)} aria-label={`ดูรายละเอียด ${row.code}`}>
          <Eye className="size-4" aria-hidden /> รายละเอียด
        </Button>
      ),
    },
  ]

  const exportColumns: Array<ExcelColumn<ProductionBatch>> = [
    { header: 'เลขที่', value: (row) => row.code },
    { header: 'วันที่', value: (row) => formatDateTime(row.createdAt) },
    { header: 'Zone', value: (row) => zoneName(row.zoneId) },
    { header: 'วัตถุดิบตั้งต้น', value: (row) => ingredientName(String(row.input.ingredientId)), width: 24 },
    { header: 'จำนวน', value: (row) => row.input.inputQuantity },
    { header: 'หน่วย', value: (row) => unitName(row.input.inputUnit) },
    { header: 'สินค้าที่ได้', value: (row) => describeOutputs(row), width: 48 },
    { header: 'Yield %', value: (row) => row.yieldPercent },
    { header: 'เศษ/เสีย', value: (row) => row.wasteQuantity },
    { header: 'ต้นทุนรวม (บาท)', value: (row) => row.totalCost },
    { header: 'หมายเหตุ', value: (row) => row.remark ?? '' },
  ]

  const formDataReady = zonesQuery.data && ingredientsQuery.data && unitsQuery.data

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">แปรรูป / แบ่ง Portion</h1>
        <p className="text-sm text-text-secondary">
          ตัดวัตถุดิบดิบ เช่น แซลม่อน 4.9 กก. → ได้แซลม่อนดอง 10 ถุง + ซาชิมิ 9 ถุง ระบบตัดสต๊อกวัตถุดิบและเพิ่มสต๊อก portion
          ให้อัตโนมัติ พร้อมคำนวณต้นทุนต่อถุง
        </p>
      </div>

      {canCreate ? (
        formDataReady ? (
          formZones.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState title="ไม่มี Zone ที่คุณบันทึกการแปรรูปได้" description="ติดต่อผู้ดูแลระบบเพื่อเพิ่มสิทธิ์เข้าถึง Zone" />
              </CardBody>
            </Card>
          ) : (
            <ProductionForm zones={formZones} ingredients={ingredientsQuery.data ?? []} units={unitsQuery.data ?? []} />
          )
        ) : zonesQuery.isError || ingredientsQuery.isError || unitsQuery.isError ? (
          <Card>
            <CardBody>
              <EmptyState
                title="โหลดข้อมูลสำหรับฟอร์มไม่สำเร็จ"
                description={getErrorMessage(zonesQuery.error ?? ingredientsQuery.error ?? unitsQuery.error)}
              />
            </CardBody>
          </Card>
        ) : (
          <LoadingState />
        )
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">ประวัติการแปรรูป</h2>
          <ExportButton fileName="ประวัติการแปรรูป" columns={exportColumns} rows={batches} />
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {batchesQuery.isError ? (
          <EmptyState
            title="โหลดประวัติการแปรรูปไม่สำเร็จ"
            description={getErrorMessage(batchesQuery.error)}
            action={
              <Button variant="secondary" size="sm" onClick={() => void batchesQuery.refetch()}>
                ลองใหม่
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={batches}
            rowKey={(row) => row._id}
            isLoading={batchesQuery.isLoading}
            emptyMessage="ยังไม่มีรายการแปรรูปในช่วงนี้"
          />
        )}
      </section>

      <ProductionDetailModal
        batch={selectedBatch}
        zoneName={selectedBatch ? zoneName(selectedBatch.zoneId) : '-'}
        ingredientName={ingredientName}
        unitName={unitName}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
