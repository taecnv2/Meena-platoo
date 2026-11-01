import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { inventoryApi, stockMovementsApi } from '@/api/endpoints/inventory'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { UnitSelect } from '@/components/UnitSelect'
import { Card, CardBody } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { PERMISSIONS } from '@/constants/permissions'
import { WAREHOUSE_ZONE_CODE } from '@/constants/zones'
import { formatDateTime } from '@/utils/format'
import { getUnitOptions } from '@/utils/units'
import type { DateRangeValue } from '@/utils/dateRange'
import type { StockMovement } from '@/types/entities'
import {
  buildUnitNameByCode,
  formatKeyedQuantity,
  optionalAmountSchema,
  toOptionalNumber,
  useResetUnitOnIngredientChange,
} from './components/inventoryFormat'

const formSchema = z.object({
  ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
  quantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
  unitId: z.string().optional(),
  unitCost: optionalAmountSchema,
  supplierId: z.string().optional(),
  invoiceNo: z.string().optional(),
  weight: optionalAmountSchema,
  remark: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function StockInPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const accessibleZoneIds = useAccessibleZoneIds()
  const canReadSuppliers = usePermission(PERMISSIONS.SUPPLIERS_READ)
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones, isLoading: isZonesLoading, isError: isZonesError } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })
  // Some roles cannot read suppliers; a failed or empty list simply hides the supplier field.
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.list,
    enabled: canReadSuppliers,
    retry: false,
  })
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['stock-movements', 'STOCK_IN', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      stockMovementsApi.list({
        movementType: 'STOCK_IN',
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i])), [ingredients])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])
  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s._id, s.name])), [suppliers])
  const unitNameByCode = useMemo(() => buildUnitNameByCode(units), [units])
  const activeSuppliers = useMemo(() => (suppliers ?? []).filter((s) => s.status === 'ACTIVE'), [suppliers])

  // Goods can be received into the warehouse, or any active zone flagged allowReceiving, that this user can access.
  const receivableZones = useMemo(
    () =>
      (zones ?? [])
        .filter((z) => z.status === 'ACTIVE' && (z.code === WAREHOUSE_ZONE_CODE || z.allowReceiving))
        .filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))
        .sort((a, b) => Number(b.code === WAREHOUSE_ZONE_CODE) - Number(a.code === WAREHOUSE_ZONE_CODE)),
    [zones, accessibleZoneIds],
  )
  const defaultZoneId = receivableZones[0]?._id ?? ''

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { zoneId: '', unitId: '' } })

  useEffect(() => {
    if (defaultZoneId) {
      setValue('zoneId', defaultZoneId)
    }
  }, [defaultZoneId, setValue])

  const selectedIngredient = ingredientMap.get(watch('ingredientId') ?? '')
  const selectedUnitId = watch('unitId')
  const quantity = Number(watch('quantity')) || 0
  useResetUnitOnIngredientChange(selectedIngredient, units, (unitId) => setValue('unitId', unitId))

  const selectedUnitName =
    getUnitOptions(selectedIngredient, units).find((option) => option.unitId === selectedUnitId)?.name ?? 'หน่วย'

  const onSubmit = async (values: FormValues) => {
    try {
      await inventoryApi.stockIn({
        ingredientId: values.ingredientId,
        zoneId: values.zoneId,
        quantity: values.quantity,
        unitId: values.unitId || undefined,
        unitCost: toOptionalNumber(values.unitCost),
        weight: toOptionalNumber(values.weight),
        supplierId: values.supplierId || undefined,
        invoiceNo: values.invoiceNo?.trim() || undefined,
        remark: values.remark?.trim() || undefined,
      })
      toast.show('success', 'รับสินค้าเข้าสต๊อกสำเร็จ')
      // Keep zone, supplier and bill number: staff usually key several lines from the same delivery.
      reset({
        ingredientId: '',
        zoneId: values.zoneId,
        quantity: 0,
        unitId: '',
        unitCost: '',
        supplierId: values.supplierId ?? '',
        invoiceNo: values.invoiceNo ?? '',
        weight: '',
        remark: '',
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
      ])
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const historyColumns: Array<DataTableColumn<StockMovement>> = [
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId)?.name ?? '-' },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatKeyedQuantity(row, unitNameByCode) },
    { key: 'unitCost', header: 'ต้นทุนต่อหน่วยหลัก', render: (row) => row.unitCost.toFixed(2) },
    { key: 'supplier', header: 'Supplier', render: (row) => (row.supplierId ? (supplierMap.get(row.supplierId) ?? '-') : '-') },
    { key: 'invoiceNo', header: 'เลขที่บิล', render: (row) => row.invoiceNo || '-' },
    { key: 'remark', header: 'หมายเหตุ', render: (row) => row.remark || '-' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">รับสินค้า</h1>
        <p className="text-sm text-text-secondary">
          บันทึกการรับวัตถุดิบเข้าคลังสินค้าหรือ Zone ที่รับของได้ เลือกหน่วยที่รับจริงได้ (เช่น ลัง) ระบบจะแปลงเป็นหน่วยหลักให้
        </p>
      </div>
      {isZonesError ? (
        <Card className="max-w-lg">
          <CardBody>
            <p className="text-sm text-danger">โหลดรายการ Zone ไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง</p>
          </CardBody>
        </Card>
      ) : !isZonesLoading && receivableZones.length === 0 ? (
        <Card className="max-w-lg">
          <CardBody>
            <p className="text-sm text-text-secondary">
              คุณไม่มีสิทธิ์เข้าถึงคลังสินค้าหรือ Zone ที่รับสินค้าได้ จึงไม่สามารถรับสินค้าได้
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <CardBody>
            <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
              <Select
                label="รับเข้า Zone"
                options={receivableZones.map((z) => ({ value: z._id, label: z.name }))}
                error={errors.zoneId?.message}
                {...register('zoneId')}
              />
              <Select
                label="วัตถุดิบ"
                placeholder="เลือกวัตถุดิบ"
                options={(ingredients ?? []).map((i) => ({ value: i._id, label: `${i.name} (${i.code})` }))}
                error={errors.ingredientId?.message}
                {...register('ingredientId')}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="จำนวน" type="number" step="0.01" inputMode="decimal" error={errors.quantity?.message} {...register('quantity')} />
                <UnitSelect
                  ingredient={selectedIngredient}
                  units={units}
                  quantity={quantity}
                  value={selectedUnitId}
                  {...register('unitId')}
                />
              </div>
              <Input
                label={`ต้นทุนต่อ${selectedUnitName} (บาท, ไม่บังคับ)`}
                type="number"
                step="0.01"
                inputMode="decimal"
                hint="เว้นว่างไว้ ระบบจะใช้ต้นทุนมาตรฐานของวัตถุดิบ"
                error={errors.unitCost?.message}
                {...register('unitCost')}
              />
              {activeSuppliers.length > 0 ? (
                <Select
                  label="Supplier (ไม่บังคับ)"
                  placeholder="ไม่ระบุ"
                  options={activeSuppliers.map((s) => ({ value: s._id, label: s.name }))}
                  {...register('supplierId')}
                />
              ) : null}
              <Input label="เลขที่บิล/ใบส่งของ (ไม่บังคับ)" {...register('invoiceNo')} />
              <Input
                label="น้ำหนักรวม (กก., ไม่บังคับ)"
                type="number"
                step="0.01"
                inputMode="decimal"
                error={errors.weight?.message}
                {...register('weight')}
              />
              <Input label="หมายเหตุ" {...register('remark')} />
              <Button type="submit" isLoading={isSubmitting}>
                บันทึกรับสินค้า
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">ประวัติการรับสินค้า</h2>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <DataTable
          columns={historyColumns}
          rows={history ?? []}
          rowKey={(row) => row._id}
          isLoading={isHistoryLoading}
          emptyMessage="ยังไม่มีประวัติการรับสินค้า"
        />
      </div>
    </div>
  )
}
