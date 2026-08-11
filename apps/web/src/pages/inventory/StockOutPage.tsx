import { useMemo, useState } from 'react'
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
import { formatDateTime, formatQuantity } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import type { StockMovement } from '@/types/entities'

const formSchema = z.object({
  ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
  quantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
  remark: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function StockOutPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const accessibleZoneIds = useAccessibleZoneIds()
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['stock-movements', 'STOCK_OUT', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      stockMovementsApi.list({
        movementType: 'STOCK_OUT',
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const onSubmit = async (values: FormValues) => {
    try {
      await inventoryApi.stockOut(values)
      toast.show('success', 'จ่ายสินค้าออกจากสต๊อกสำเร็จ')
      reset({ ingredientId: '', zoneId: values.zoneId, quantity: 0, remark: '' })
      await queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const historyColumns: Array<DataTableColumn<StockMovement>> = [
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId) ?? '-' },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatQuantity(row.quantity, row.unit) },
    { key: 'remark', header: 'หมายเหตุ', render: (row) => row.remark ?? '-' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">จ่ายสินค้า</h1>
        <p className="text-sm text-text-secondary">บันทึกการจ่ายวัตถุดิบออกจากสต๊อก</p>
      </div>
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
            <Select
              label="Zone ต้นทาง"
              placeholder="เลือก Zone"
              options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
              error={errors.zoneId?.message}
              {...register('zoneId')}
            />
            <Input label="จำนวน" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
            <Input label="หมายเหตุ" {...register('remark')} />
            <Button type="submit" isLoading={isSubmitting}>
              บันทึกจ่ายสินค้า
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">ประวัติการจ่ายสินค้า</h2>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <DataTable
          columns={historyColumns}
          rows={history ?? []}
          rowKey={(row) => row._id}
          isLoading={isHistoryLoading}
          emptyMessage="ยังไม่มีประวัติการจ่ายสินค้า"
        />
      </div>
    </div>
  )
}
