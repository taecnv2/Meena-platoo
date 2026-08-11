import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { inventoryApi, stockMovementsApi } from '@/api/endpoints/inventory'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Card, CardBody } from '@/components/Card'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { useToast } from '@/components/Toast'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { WAREHOUSE_ZONE_CODE } from '@/constants/zones'
import { formatDateTime, formatQuantity } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import type { StockMovement } from '@/types/entities'

const formSchema = z.object({
  ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
  quantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
  unitCost: z.coerce.number().min(0).optional(),
  remark: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function StockInPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const accessibleZoneIds = useAccessibleZoneIds()
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['stock-movements', 'STOCK_IN', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      stockMovementsApi.list({
        movementType: 'STOCK_IN',
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const warehouseZone = useMemo(() => (zones ?? []).find((z) => z.code === WAREHOUSE_ZONE_CODE), [zones])
  const hasWarehouseAccess =
    !accessibleZoneIds || (warehouseZone ? accessibleZoneIds.includes(warehouseZone._id) : false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { zoneId: '' } })

  useEffect(() => {
    if (warehouseZone) {
      setValue('zoneId', warehouseZone._id)
    }
  }, [warehouseZone, setValue])

  const onSubmit = async (values: FormValues) => {
    try {
      await inventoryApi.stockIn(values)
      toast.show('success', 'รับสินค้าเข้าสต๊อกสำเร็จ')
      reset({ ingredientId: '', zoneId: values.zoneId, quantity: 0, unitCost: undefined, remark: '' })
      await queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const historyColumns: Array<DataTableColumn<StockMovement>> = [
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId) ?? '-' },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatQuantity(row.quantity, row.unit) },
    { key: 'unitCost', header: 'ต้นทุนต่อหน่วย', render: (row) => row.unitCost.toFixed(2) },
    { key: 'remark', header: 'หมายเหตุ', render: (row) => row.remark ?? '-' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">รับสินค้า</h1>
        <p className="text-sm text-text-secondary">บันทึกการรับวัตถุดิบเข้าคลังสินค้า</p>
      </div>
      {!hasWarehouseAccess ? (
        <Card className="max-w-lg">
          <CardBody>
            <p className="text-sm text-text-secondary">คุณไม่มีสิทธิ์เข้าถึงคลังสินค้า จึงไม่สามารถรับสินค้าได้</p>
          </CardBody>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <CardBody>
            <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
              <Select
                label="วัตถุดิบ"
                placeholder="เลือกวัตถุดิบ"
                options={(ingredients ?? []).map((i) => ({ value: i._id, label: `${i.name} (${i.code})` }))}
                error={errors.ingredientId?.message}
                {...register('ingredientId')}
              />
              <input type="hidden" {...register('zoneId')} />
              <p className="text-sm text-text-secondary">
                รับเข้า: <span className="font-medium text-text-primary">{warehouseZone?.name ?? 'คลังสินค้า'}</span>
              </p>
              <Input label="จำนวน" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
              <Input label="ต้นทุนต่อหน่วย (บาท, ไม่บังคับ)" type="number" step="0.01" {...register('unitCost')} />
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
