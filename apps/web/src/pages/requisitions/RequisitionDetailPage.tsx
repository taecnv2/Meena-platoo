import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { requisitionsApi } from '@/api/endpoints/requisitions'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingState } from '@/components/LoadingState'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { REQUISITION_STATUS_COLOR, REQUISITION_STATUS_LABEL } from '@/constants/labels'
import { formatDateTime, formatQuantity } from '@/utils/format'

export function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const canApprove = usePermission(PERMISSIONS.REQUISITION_APPROVE)
  const canReject = usePermission(PERMISSIONS.REQUISITION_REJECT)
  const canFulfill = usePermission(PERMISSIONS.REQUISITION_FULFILL)
  const canCancel = usePermission(PERMISSIONS.REQUISITION_CANCEL)

  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isFulfilling, setIsFulfilling] = useState(false)
  const [fulfillQuantities, setFulfillQuantities] = useState<Record<string, number>>({})
  const [isConfirmingApprove, setIsConfirmingApprove] = useState(false)
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [isMutating, setIsMutating] = useState(false)

  const { data: requisition, isLoading } = useQuery({
    queryKey: ['requisitions', id],
    queryFn: () => requisitionsApi.get(id as string),
    enabled: Boolean(id),
  })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requisitions'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
    ])

  const handleApprove = async () => {
    if (!requisition) return
    setIsMutating(true)
    try {
      await requisitionsApi.approve(requisition._id, {})
      toast.show('success', 'อนุมัติใบเบิกสำเร็จ')
      await invalidate()
      setIsConfirmingApprove(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleReject = async () => {
    if (!requisition || !rejectionReason.trim()) return
    setIsMutating(true)
    try {
      await requisitionsApi.reject(requisition._id, rejectionReason.trim())
      toast.show('success', 'ปฏิเสธใบเบิกสำเร็จ')
      await invalidate()
      setIsRejecting(false)
      setRejectionReason('')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleCancel = async () => {
    if (!requisition) return
    setIsMutating(true)
    try {
      await requisitionsApi.cancel(requisition._id)
      toast.show('success', 'ยกเลิกใบเบิกสำเร็จ')
      await invalidate()
      setIsConfirmingCancel(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const outstandingItems = useMemo(
    () => requisition?.items.filter((item) => item.fulfilledQuantity < item.approvedQuantity) ?? [],
    [requisition],
  )

  const openFulfillModal = () => {
    if (outstandingItems.length === 0) {
      toast.show('info', 'ไม่มีรายการที่ต้องจ่ายเพิ่ม')
      return
    }
    setFulfillQuantities(
      Object.fromEntries(outstandingItems.map((item) => [item.ingredientId, item.approvedQuantity - item.fulfilledQuantity])),
    )
    setIsFulfilling(true)
  }

  const hasInvalidFulfillQuantity = outstandingItems.some((item) => {
    const remaining = item.approvedQuantity - item.fulfilledQuantity
    const value = fulfillQuantities[item.ingredientId] ?? 0
    return value < 0 || value > remaining
  })
  const hasAnyPositiveFulfillQuantity = outstandingItems.some((item) => (fulfillQuantities[item.ingredientId] ?? 0) > 0)

  const handleFulfill = async () => {
    if (!requisition) return
    const items = outstandingItems
      .map((item) => ({ ingredientId: item.ingredientId, quantity: fulfillQuantities[item.ingredientId] ?? 0 }))
      .filter((item) => item.quantity > 0)
    if (items.length === 0) {
      toast.show('info', 'กรุณาระบุจำนวนที่จะจ่ายอย่างน้อยหนึ่งรายการ')
      return
    }
    setIsMutating(true)
    try {
      await requisitionsApi.fulfill(requisition._id, { items })
      toast.show('success', 'จ่ายสินค้าตามใบเบิกสำเร็จ')
      await invalidate()
      setIsFulfilling(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  if (isLoading || !requisition) {
    return <LoadingState />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text-primary">{requisition.code}</h1>
            <Badge color={REQUISITION_STATUS_COLOR[requisition.status]}>{REQUISITION_STATUS_LABEL[requisition.status]}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {zoneMap.get(requisition.toZoneId) ?? '-'} เบิกจาก {zoneMap.get(requisition.fromZoneId) ?? '-'} · {formatDateTime(requisition.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove && requisition.status === 'PENDING' ? (
            <Button onClick={() => setIsConfirmingApprove(true)}>อนุมัติ</Button>
          ) : null}
          {canReject && requisition.status === 'PENDING' ? (
            <Button variant="danger" onClick={() => setIsRejecting(true)}>
              ปฏิเสธ
            </Button>
          ) : null}
          {canFulfill && ['APPROVED', 'PARTIALLY_FULFILLED'].includes(requisition.status) ? (
            <Button onClick={openFulfillModal}>จ่ายสินค้า</Button>
          ) : null}
          {canCancel && ['DRAFT', 'PENDING', 'APPROVED'].includes(requisition.status) ? (
            <Button variant="secondary" onClick={() => setIsConfirmingCancel(true)}>
              ยกเลิก
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate('/requisitions')}>
            กลับ
          </Button>
        </div>
      </div>

      {requisition.status === 'REJECTED' && requisition.rejectionReason ? (
        <Card>
          <CardBody className="text-sm text-danger">เหตุผลที่ปฏิเสธ: {requisition.rejectionReason}</CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <span className="font-medium text-text-primary">รายการวัตถุดิบ</span>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="py-2 font-medium">วัตถุดิบ</th>
                <th className="py-2 font-medium">ขอเบิก</th>
                <th className="py-2 font-medium">อนุมัติ</th>
                <th className="py-2 font-medium">จ่ายแล้ว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requisition.items.map((item) => (
                <tr key={item.ingredientId}>
                  <td className="py-2">{ingredientMap.get(item.ingredientId) ?? '-'}</td>
                  <td className="py-2">{formatQuantity(item.requestedQuantity, item.unit)}</td>
                  <td className="py-2">{formatQuantity(item.approvedQuantity, item.unit)}</td>
                  <td className="py-2">{formatQuantity(item.fulfilledQuantity, item.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <ConfirmDialog
        isOpen={isConfirmingApprove}
        title="อนุมัติใบเบิก"
        message={`อนุมัติใบเบิก ${requisition.code} ตามจำนวนที่ขอเบิก?`}
        confirmLabel="อนุมัติ"
        isLoading={isMutating}
        onConfirm={() => void handleApprove()}
        onCancel={() => setIsConfirmingApprove(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingCancel}
        title="ยกเลิกใบเบิก"
        message={`ยืนยันการยกเลิกใบเบิก ${requisition.code}?`}
        confirmLabel="ยกเลิกใบเบิก"
        danger
        isLoading={isMutating}
        onConfirm={() => void handleCancel()}
        onCancel={() => setIsConfirmingCancel(false)}
      />

      <Modal isOpen={isRejecting} onClose={() => setIsRejecting(false)} title="ปฏิเสธใบเบิก">
        <div className="flex flex-col gap-4">
          <Input label="เหตุผลที่ปฏิเสธ" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
          <Button variant="danger" isLoading={isMutating} disabled={!rejectionReason.trim()} onClick={() => void handleReject()}>
            ยืนยันการปฏิเสธ
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isFulfilling} onClose={() => setIsFulfilling(false)} title="จ่ายสินค้าตามใบเบิก">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            ระบุจำนวนที่จะจ่ายสำหรับแต่ละรายการของใบเบิก {requisition.code} (จ่ายบางส่วนได้ ไม่เกินจำนวนที่เหลือ)
          </p>
          <div className="flex flex-col gap-3">
            {outstandingItems.map((item) => {
              const remaining = item.approvedQuantity - item.fulfilledQuantity
              const value = fulfillQuantities[item.ingredientId] ?? 0
              const error = value > remaining ? 'จำนวนเกินยอดคงเหลือ' : value < 0 ? 'จำนวนต้องไม่ติดลบ' : undefined
              return (
                <Input
                  key={item.ingredientId}
                  label={`${ingredientMap.get(item.ingredientId) ?? '-'} (เหลือ ${formatQuantity(remaining, item.unit)})`}
                  type="number"
                  min={0}
                  max={remaining}
                  step="any"
                  value={value}
                  error={error}
                  onChange={(event) =>
                    setFulfillQuantities((prev) => ({ ...prev, [item.ingredientId]: Number(event.target.value) }))
                  }
                />
              )
            })}
          </div>
          <Button
            isLoading={isMutating}
            disabled={hasInvalidFulfillQuantity || !hasAnyPositiveFulfillQuantity}
            onClick={() => void handleFulfill()}
          >
            ยืนยันการจ่ายสินค้า
          </Button>
        </div>
      </Modal>
    </div>
  )
}
