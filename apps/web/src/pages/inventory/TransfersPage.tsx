import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { transfersApi } from '@/api/endpoints/transfers'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { PERMISSIONS } from '@/constants/permissions'
import { TRANSFER_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime, formatQuantity } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import type { Transfer } from '@/types/entities'

const formSchema = z.object({
  fromZoneId: z.string().min(1, 'กรุณาเลือก Zone ต้นทาง'),
  toZoneId: z.string().min(1, 'กรุณาเลือก Zone ปลายทาง'),
  ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  quantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
})
type FormValues = z.infer<typeof formSchema>

export function TransfersPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.TRANSFER_CREATE)
  const accessibleZoneIds = useAccessibleZoneIds()
  const [isCreating, setIsCreating] = useState(false)
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['transfers', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      transfersApi.list({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })

  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])
  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const openCreate = () => {
    reset({ fromZoneId: '', toZoneId: '', ingredientId: '', quantity: 0 })
    setIsCreating(true)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await transfersApi.create({
        fromZoneId: values.fromZoneId,
        toZoneId: values.toZoneId,
        items: [{ ingredientId: values.ingredientId, quantity: values.quantity }],
      })
      toast.show('success', 'โอนสินค้าสำเร็จ')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transfers'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
      ])
      setIsCreating(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<Transfer>> = [
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'from', header: 'จาก', render: (row) => zoneMap.get(row.fromZoneId) ?? '-' },
    { key: 'to', header: 'ถึง', render: (row) => zoneMap.get(row.toZoneId) ?? '-' },
    {
      key: 'items',
      header: 'รายการ',
      render: (row) => row.items.map((item) => `${ingredientMap.get(item.ingredientId) ?? '-'} (${formatQuantity(item.quantity, item.unit)})`).join(', '),
    },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => (
        <Badge color={row.status === 'COMPLETED' ? 'success' : row.status === 'CANCELLED' ? 'gray' : 'warning'}>
          {TRANSFER_STATUS_LABEL[row.status]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">โอนสินค้า</h1>
          <p className="text-sm text-text-secondary">โอนวัตถุดิบระหว่าง Zone โดยตรง</p>
        </div>
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> โอนสินค้า
          </Button>
        ) : null}
      </div>

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <DataTable columns={columns} rows={transfers ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีการโอนสินค้า" />

      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="โอนสินค้า">
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Select
            label="Zone ต้นทาง"
            placeholder="เลือก Zone ต้นทาง"
            options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
            error={errors.fromZoneId?.message}
            {...register('fromZoneId')}
          />
          <Select
            label="Zone ปลายทาง"
            placeholder="เลือก Zone ปลายทาง"
            options={(zones ?? []).map((z) => ({ value: z._id, label: z.name }))}
            error={errors.toZoneId?.message}
            {...register('toZoneId')}
          />
          <Select
            label="วัตถุดิบ"
            placeholder="เลือกวัตถุดิบ"
            options={(ingredients ?? []).map((i) => ({ value: i._id, label: `${i.name} (${i.code})` }))}
            error={errors.ingredientId?.message}
            {...register('ingredientId')}
          />
          <Input label="จำนวน" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
          <Button type="submit" isLoading={isSubmitting}>
            บันทึกการโอน
          </Button>
        </form>
      </Modal>
    </div>
  )
}
