import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { wasteApi } from '@/api/endpoints/waste'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { Card, CardBody } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { PERMISSIONS } from '@/constants/permissions'
import { WASTE_REASON_LABEL, WASTE_STATUS_COLOR, WASTE_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime, formatQuantity } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { WASTE_REASONS, WASTE_STATUSES, type Waste, type WasteStatus } from '@/types/entities'

const formSchema = z.object({
  zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
  ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  quantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
  reason: z.enum(WASTE_REASONS),
  remark: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function WastePage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const canCreate = usePermission(PERMISSIONS.WASTE_CREATE)
  const canApprove = usePermission(PERMISSIONS.WASTE_APPROVE)
  const accessibleZoneIds = useAccessibleZoneIds()

  const [statusFilter, setStatusFilter] = useState<WasteStatus | ''>('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isMutating, setIsMutating] = useState(false)

  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: wasteRecords, isLoading } = useQuery({
    queryKey: ['waste', statusFilter, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      wasteApi.list({
        status: statusFilter || undefined,
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])
  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['waste'] })

  const onSubmit = async (values: FormValues) => {
    try {
      const waste = await wasteApi.create(values)
      toast.show('success', `บันทึกของเสีย ${waste.code} สำเร็จ รอการอนุมัติ`)
      reset({ zoneId: values.zoneId, ingredientId: '', quantity: 0, reason: values.reason, remark: '' })
      await invalidate()
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const handleApprove = async () => {
    if (!approvingId) return
    setIsMutating(true)
    try {
      await wasteApi.approve(approvingId)
      toast.show('success', 'อนุมัติรายการของเสียสำเร็จ')
      await invalidate()
      setApprovingId(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return
    setIsMutating(true)
    try {
      await wasteApi.reject(rejectingId, rejectionReason.trim())
      toast.show('success', 'ปฏิเสธรายการของเสียสำเร็จ')
      await invalidate()
      setRejectingId(null)
      setRejectionReason('')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const columns: Array<DataTableColumn<Waste>> = [
    { key: 'code', header: 'เลขที่', render: (row) => row.code },
    { key: 'date', header: 'วันที่', render: (row) => formatDateTime(row.createdAt) },
    { key: 'zone', header: 'Zone', render: (row) => zoneMap.get(row.zoneId) ?? '-' },
    { key: 'ingredient', header: 'วัตถุดิบ', render: (row) => ingredientMap.get(row.ingredientId) ?? '-' },
    { key: 'quantity', header: 'จำนวน', render: (row) => formatQuantity(row.quantity, row.unit) },
    { key: 'reason', header: 'สาเหตุ', render: (row) => WASTE_REASON_LABEL[row.reason] },
    {
      key: 'status',
      header: 'สถานะ',
      render: (row) => <Badge color={WASTE_STATUS_COLOR[row.status]}>{WASTE_STATUS_LABEL[row.status]}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canApprove && row.status === 'PENDING_APPROVAL' ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setApprovingId(row._id)}>
              อนุมัติ
            </Button>
            <Button size="sm" variant="danger" onClick={() => setRejectingId(row._id)}>
              ปฏิเสธ
            </Button>
          </div>
        ) : null,
    },
  ]

  const approvingWaste = wasteRecords?.find((w) => w._id === approvingId)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">ของเสีย</h1>
        <p className="text-sm text-text-secondary">บันทึกและอนุมัติของเสียในแต่ละ Zone</p>
      </div>

      {canCreate ? (
        <Card className="max-w-2xl">
          <CardBody>
            <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Zone"
                  placeholder="เลือก Zone"
                  options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
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
                <Input label="จำนวน" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
                <Select
                  label="สาเหตุ"
                  placeholder="เลือกสาเหตุ"
                  options={WASTE_REASONS.map((reason) => ({ value: reason, label: WASTE_REASON_LABEL[reason] }))}
                  error={errors.reason?.message}
                  {...register('reason')}
                />
              </div>
              <Input label="หมายเหตุ (ถ้ามี)" {...register('remark')} />
              <Button type="submit" isLoading={isSubmitting} className="self-start">
                บันทึกของเสีย
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">รายการของเสีย</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="max-w-xs">
            <Select
              label="สถานะ"
              placeholder="ทุกสถานะ"
              options={WASTE_STATUSES.map((status) => ({ value: status, label: WASTE_STATUS_LABEL[status] }))}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as WasteStatus | '')}
            />
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        <DataTable columns={columns} rows={wasteRecords ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีรายการของเสีย" />
      </div>

      <ConfirmDialog
        isOpen={Boolean(approvingId)}
        title="อนุมัติของเสีย"
        message={`อนุมัติรายการของเสีย ${approvingWaste?.code ?? ''}? สต๊อกจะถูกตัดออกทันที`}
        confirmLabel="อนุมัติ"
        isLoading={isMutating}
        onConfirm={() => void handleApprove()}
        onCancel={() => setApprovingId(null)}
      />

      <Modal isOpen={Boolean(rejectingId)} onClose={() => setRejectingId(null)} title="ปฏิเสธของเสีย">
        <div className="flex flex-col gap-4">
          <Input label="เหตุผลที่ปฏิเสธ" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
          <Button variant="danger" isLoading={isMutating} disabled={!rejectionReason.trim()} onClick={() => void handleReject()}>
            ยืนยันการปฏิเสธ
          </Button>
        </div>
      </Modal>
    </div>
  )
}
