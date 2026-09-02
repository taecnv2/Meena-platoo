import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { stockCountsApi } from '@/api/endpoints/stockCounts'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { ExportButton } from '@/components/ExportButton'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { PERMISSIONS } from '@/constants/permissions'
import { STOCK_COUNT_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime } from '@/utils/format'
import type { StockCount } from '@/types/entities'

const formSchema = z.object({
  zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
        actualQuantity: z.coerce.number().min(0, 'กรุณากรอกจำนวนที่นับได้'),
      }),
    )
    .min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ'),
})
type FormValues = z.infer<typeof formSchema>

export function StockCountsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.STOCK_COUNT_CREATE)
  const canApprove = usePermission(PERMISSIONS.STOCK_COUNT_APPROVE)
  const canExport = usePermission(PERMISSIONS.STOCK_COUNT_EXPORT)
  const accessibleZoneIds = useAccessibleZoneIds()
  const [isCreating, setIsCreating] = useState(false)
  const [approving, setApproving] = useState<StockCount | null>(null)

  const { data: stockCounts, isLoading } = useQuery({ queryKey: ['stock-counts'], queryFn: stockCountsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })

  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])
  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { zoneId: '', items: [{ ingredientId: '', actualQuantity: 0 }] } })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const openCreate = () => {
    reset({ zoneId: '', items: [{ ingredientId: '', actualQuantity: 0 }] })
    setIsCreating(true)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await stockCountsApi.create(values)
      toast.show('success', 'สร้างรายการตรวจนับสำเร็จ')
      await queryClient.invalidateQueries({ queryKey: ['stock-counts'] })
      setIsCreating(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const handleApprove = async () => {
    if (!approving) return
    try {
      await stockCountsApi.approve(approving._id)
      toast.show('success', 'อนุมัติการตรวจนับสำเร็จ')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
      ])
      setApproving(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<StockCount>> = [
    { key: 'code', header: 'เลขที่', render: (row) => row.code },
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    {
      key: 'items',
      header: 'รายการ',
      render: (row) => row.items.map((item) => ingredientMap.get(item.ingredientId) ?? '-').join(', '),
    },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => (
        <Badge color={row.status === 'APPROVED' ? 'success' : row.status === 'CANCELLED' ? 'gray' : 'warning'}>
          {STOCK_COUNT_STATUS_LABEL[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canApprove && row.status === 'PENDING_APPROVAL' ? (
          <button type="button" className="text-primary hover:underline" onClick={() => setApproving(row)}>
            <CheckCircle2 className="inline size-4" /> อนุมัติ
          </button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">ตรวจนับสต๊อก</h1>
          <p className="text-sm text-text-secondary">บันทึกและอนุมัติการตรวจนับสต๊อก</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? <ExportButton onExport={(format) => stockCountsApi.exportFile(format)} /> : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> ตรวจนับใหม่
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable columns={columns} rows={stockCounts ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีรายการตรวจนับ" />

      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="สร้างรายการตรวจนับสต๊อก">
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Select
            label="Zone"
            placeholder="เลือก Zone"
            options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
            error={errors.zoneId?.message}
            {...register('zoneId')}
          />
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-border p-3">
                <div className="flex-1">
                  <Select
                    label="วัตถุดิบ"
                    placeholder="เลือกวัตถุดิบ"
                    options={(ingredients ?? []).map((i) => ({ value: i._id, label: i.name }))}
                    error={errors.items?.[index]?.ingredientId?.message}
                    {...register(`items.${index}.ingredientId`)}
                  />
                </div>
                <div className="w-28">
                  <Input
                    label="จำนวนนับได้"
                    type="number"
                    step="0.01"
                    error={errors.items?.[index]?.actualQuantity?.message}
                    {...register(`items.${index}.actualQuantity`)}
                  />
                </div>
                <button type="button" onClick={() => remove(index)} className="mb-2.5 p-2 text-danger" aria-label="ลบรายการ">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => append({ ingredientId: '', actualQuantity: 0 })}>
              <Plus className="size-4" /> เพิ่มรายการ
            </Button>
          </div>
          <Button type="submit" isLoading={isSubmitting}>
            บันทึกการตรวจนับ
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={approving !== null}
        title="อนุมัติการตรวจนับสต๊อก"
        message={`ยืนยันการอนุมัติรายการตรวจนับ ${approving?.code ?? ''}? ระบบจะปรับปรุงสต๊อกตามผลต่างที่นับได้`}
        confirmLabel="อนุมัติ"
        onConfirm={() => void handleApprove()}
        onCancel={() => setApproving(null)}
      />
    </div>
  )
}
