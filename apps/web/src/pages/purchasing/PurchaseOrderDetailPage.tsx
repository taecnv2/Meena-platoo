import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
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
import { PURCHASE_ORDER_STATUS_COLOR, PURCHASE_ORDER_STATUS_LABEL } from '@/constants/labels'
import { formatCurrency, formatDateTime, formatQuantity } from '@/utils/format'

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const canCreate = usePermission(PERMISSIONS.PURCHASING_CREATE)
  const canApprove = usePermission(PERMISSIONS.PURCHASING_APPROVE)
  const canReceive = usePermission(PERMISSIONS.PURCHASING_RECEIVE)

  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false)
  const [isConfirmingApprove, setIsConfirmingApprove] = useState(false)
  const [isConfirmingReceive, setIsConfirmingReceive] = useState(false)
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [isMutating, setIsMutating] = useState(false)

  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchasing', id],
    queryFn: () => purchasingApi.get(id as string),
    enabled: Boolean(id),
  })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i.name])), [ingredients])
  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s._id, s.name])), [suppliers])

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['purchasing'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
    ])

  const handleSubmitOrder = async () => {
    if (!purchaseOrder) return
    setIsMutating(true)
    try {
      await purchasingApi.submit(purchaseOrder._id)
      toast.show('success', 'ส่งใบสั่งซื้อเพื่อขออนุมัติสำเร็จ')
      await invalidate()
      setIsConfirmingSubmit(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleApprove = async () => {
    if (!purchaseOrder) return
    setIsMutating(true)
    try {
      await purchasingApi.approve(purchaseOrder._id)
      toast.show('success', 'อนุมัติใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsConfirmingApprove(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleReject = async () => {
    if (!purchaseOrder || !rejectionReason.trim()) return
    setIsMutating(true)
    try {
      await purchasingApi.reject(purchaseOrder._id, rejectionReason.trim())
      toast.show('success', 'ปฏิเสธใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsRejecting(false)
      setRejectionReason('')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleReceive = async () => {
    if (!purchaseOrder) return
    const items = purchaseOrder.items
      .filter((item) => item.receivedQuantity < item.orderedQuantity)
      .map((item) => ({ ingredientId: item.ingredientId }))
    if (items.length === 0) {
      toast.show('info', 'ไม่มีรายการที่ต้องรับเพิ่ม')
      return
    }
    setIsMutating(true)
    try {
      await purchasingApi.receive(purchaseOrder._id, { items })
      toast.show('success', 'รับสินค้าตามใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsConfirmingReceive(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  const handleCancel = async () => {
    if (!purchaseOrder) return
    setIsMutating(true)
    try {
      await purchasingApi.cancel(purchaseOrder._id)
      toast.show('success', 'ยกเลิกใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsConfirmingCancel(false)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  if (isLoading || !purchaseOrder) {
    return <LoadingState />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text-primary">{purchaseOrder.code}</h1>
            <Badge color={PURCHASE_ORDER_STATUS_COLOR[purchaseOrder.status]}>{PURCHASE_ORDER_STATUS_LABEL[purchaseOrder.status]}</Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {supplierMap.get(purchaseOrder.supplierId) ?? '-'} · {formatDateTime(purchaseOrder.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && purchaseOrder.status === 'DRAFT' ? (
            <Button onClick={() => setIsConfirmingSubmit(true)}>ส่งขออนุมัติ</Button>
          ) : null}
          {canApprove && purchaseOrder.status === 'PENDING' ? (
            <Button onClick={() => setIsConfirmingApprove(true)}>อนุมัติ</Button>
          ) : null}
          {canApprove && purchaseOrder.status === 'PENDING' ? (
            <Button variant="danger" onClick={() => setIsRejecting(true)}>
              ปฏิเสธ
            </Button>
          ) : null}
          {canReceive && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status) ? (
            <Button onClick={() => setIsConfirmingReceive(true)}>รับสินค้า</Button>
          ) : null}
          {canCreate && ['DRAFT', 'PENDING'].includes(purchaseOrder.status) ? (
            <Button variant="secondary" onClick={() => setIsConfirmingCancel(true)}>
              ยกเลิก
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate('/purchasing')}>
            กลับ
          </Button>
        </div>
      </div>

      {purchaseOrder.status === 'REJECTED' && purchaseOrder.rejectionReason ? (
        <Card>
          <CardBody className="text-sm text-danger">เหตุผลที่ปฏิเสธ: {purchaseOrder.rejectionReason}</CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <span className="font-medium text-text-primary">รายการวัตถุดิบ</span>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="py-2 font-medium">วัตถุดิบ</th>
                <th className="py-2 font-medium">สั่งซื้อ</th>
                <th className="py-2 font-medium">รับแล้ว</th>
                <th className="py-2 font-medium">ราคาต่อหน่วย</th>
                <th className="py-2 font-medium">มูลค่ารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchaseOrder.items.map((item) => (
                <tr key={item.ingredientId}>
                  <td className="py-2">{ingredientMap.get(item.ingredientId) ?? '-'}</td>
                  <td className="py-2">{formatQuantity(item.orderedQuantity, item.unit)}</td>
                  <td className="py-2">{formatQuantity(item.receivedQuantity, item.unit)}</td>
                  <td className="py-2">{formatCurrency(item.unitCost)}</td>
                  <td className="py-2">{formatCurrency(item.unitCost * item.orderedQuantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <ConfirmDialog
        isOpen={isConfirmingSubmit}
        title="ส่งใบสั่งซื้อเพื่อขออนุมัติ"
        message={`ส่งใบสั่งซื้อ ${purchaseOrder.code} เพื่อขออนุมัติ?`}
        confirmLabel="ส่งขออนุมัติ"
        isLoading={isMutating}
        onConfirm={() => void handleSubmitOrder()}
        onCancel={() => setIsConfirmingSubmit(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingApprove}
        title="อนุมัติใบสั่งซื้อ"
        message={`อนุมัติใบสั่งซื้อ ${purchaseOrder.code}?`}
        confirmLabel="อนุมัติ"
        isLoading={isMutating}
        onConfirm={() => void handleApprove()}
        onCancel={() => setIsConfirmingApprove(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingReceive}
        title="รับสินค้าตามใบสั่งซื้อ"
        message={`รับสินค้าเข้าคลังสินค้าให้ครบตามจำนวนที่สั่งซื้อซึ่งยังไม่ได้รับสำหรับใบสั่งซื้อ ${purchaseOrder.code}?`}
        confirmLabel="ยืนยันการรับสินค้า"
        isLoading={isMutating}
        onConfirm={() => void handleReceive()}
        onCancel={() => setIsConfirmingReceive(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingCancel}
        title="ยกเลิกใบสั่งซื้อ"
        message={`ยืนยันการยกเลิกใบสั่งซื้อ ${purchaseOrder.code}?`}
        confirmLabel="ยกเลิกใบสั่งซื้อ"
        danger
        isLoading={isMutating}
        onConfirm={() => void handleCancel()}
        onCancel={() => setIsConfirmingCancel(false)}
      />

      <Modal isOpen={isRejecting} onClose={() => setIsRejecting(false)} title="ปฏิเสธใบสั่งซื้อ">
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
