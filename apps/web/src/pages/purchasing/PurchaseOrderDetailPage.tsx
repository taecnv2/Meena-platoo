import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadingState } from '@/components/LoadingState'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { PERMISSIONS } from '@/constants/permissions'
import { WAREHOUSE_ZONE_CODE } from '@/constants/zones'
import { PURCHASE_ORDER_STATUS_COLOR, PURCHASE_ORDER_STATUS_LABEL } from '@/constants/labels'
import { formatCurrency, formatDateTime, formatNumber, formatQuantity } from '@/utils/format'
import type { PurchaseOrderItem } from '@/types/entities'

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
  const [isReceiving, setIsReceiving] = useState(false)
  const [receiveZoneId, setReceiveZoneId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [isMutating, setIsMutating] = useState(false)

  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchasing', id],
    queryFn: () => purchasingApi.get(id as string),
    enabled: Boolean(id),
  })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const accessibleZoneIds = useAccessibleZoneIds()

  const ingredientById = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i])), [ingredients])
  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s._id, s.name])), [suppliers])
  const unitById = useMemo(() => new Map((units ?? []).map((u) => [u._id, u])), [units])
  const unitByCode = useMemo(() => new Map((units ?? []).map((u) => [u.code, u])), [units])

  // Supplier goods may only land in the WAREHOUSE or a zone flagged allowReceiving that this user can access.
  const receivingZones = useMemo(
    () =>
      (zones ?? []).filter(
        (zone) =>
          zone.status === 'ACTIVE' &&
          (zone.code === WAREHOUSE_ZONE_CODE || zone.allowReceiving) &&
          (!accessibleZoneIds || accessibleZoneIds.includes(zone._id)),
      ),
    [zones, accessibleZoneIds],
  )

  /** Display name of the unit a PO line was ordered in (ลัง, กก. ...), falling back to the stored code. */
  const lineUnitName = (item: PurchaseOrderItem) =>
    (item.unitId ? unitById.get(item.unitId)?.name : undefined) ?? unitByCode.get(item.unit)?.name ?? item.unit

  /** "= 12 ขวด" for a line ordered in a pack unit; null when it is already the base unit. */
  const lineConversion = (item: PurchaseOrderItem) => {
    const factor = item.conversionFactor ?? 1
    if (factor === 1) return null
    const baseUnitId = ingredientById.get(item.ingredientId)?.baseUnitId
    const baseName = baseUnitId ? unitById.get(baseUnitId)?.name : undefined
    return baseName ? `1 ${lineUnitName(item)} = ${formatNumber(factor)} ${baseName}` : null
  }

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

  // Default to the PO's delivery zone (WAREHOUSE) when the user may receive there, else the first allowed zone.
  const defaultReceiveZoneId = receivingZones.some((zone) => zone._id === purchaseOrder?.deliveryZoneId)
    ? (purchaseOrder?.deliveryZoneId ?? '')
    : (receivingZones[0]?._id ?? '')
  const selectedReceiveZoneId = receivingZones.some((zone) => zone._id === receiveZoneId) ? receiveZoneId : defaultReceiveZoneId

  const openReceive = () => {
    setReceiveZoneId('')
    setInvoiceNo('')
    setIsReceiving(true)
  }

  const handleReceive = async () => {
    if (!purchaseOrder || !selectedReceiveZoneId) return
    const items = purchaseOrder.items
      .filter((item) => item.receivedQuantity < item.orderedQuantity)
      .map((item) => ({ ingredientId: item.ingredientId }))
    if (items.length === 0) {
      toast.show('info', 'ไม่มีรายการที่ต้องรับเพิ่ม')
      return
    }
    setIsMutating(true)
    try {
      await purchasingApi.receive(purchaseOrder._id, {
        items,
        zoneId: selectedReceiveZoneId,
        invoiceNo: invoiceNo.trim() || undefined,
      })
      toast.show('success', 'รับสินค้าตามใบสั่งซื้อสำเร็จ')
      await invalidate()
      setIsReceiving(false)
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
            <Button onClick={openReceive}>รับสินค้า</Button>
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="py-2 font-medium">วัตถุดิบ</th>
                <th className="py-2 font-medium">หน่วยที่สั่ง</th>
                <th className="py-2 font-medium">สั่งซื้อ</th>
                <th className="py-2 font-medium">รับแล้ว</th>
                <th className="py-2 font-medium">ราคาต่อหน่วยที่สั่ง</th>
                <th className="py-2 font-medium">มูลค่ารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchaseOrder.items.map((item) => (
                <tr key={item.ingredientId}>
                  <td className="py-2">{ingredientById.get(item.ingredientId)?.name ?? '-'}</td>
                  <td className="py-2">
                    <div className="flex flex-col">
                      <span>{lineUnitName(item)}</span>
                      {lineConversion(item) ? <span className="text-xs text-text-secondary">{lineConversion(item)}</span> : null}
                    </div>
                  </td>
                  <td className="py-2">{formatQuantity(item.orderedQuantity, lineUnitName(item))}</td>
                  <td className="py-2">{formatQuantity(item.receivedQuantity, lineUnitName(item))}</td>
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

      <Modal
        isOpen={isReceiving}
        onClose={() => setIsReceiving(false)}
        title="รับสินค้าตามใบสั่งซื้อ"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsReceiving(false)} disabled={isMutating}>
              ยกเลิก
            </Button>
            <Button onClick={() => void handleReceive()} isLoading={isMutating} disabled={!selectedReceiveZoneId}>
              ยืนยันการรับสินค้า
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            รับสินค้าให้ครบตามจำนวนที่ยังไม่ได้รับของใบสั่งซื้อ {purchaseOrder.code}
          </p>
          <ul className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            {purchaseOrder.items
              .filter((item) => item.receivedQuantity < item.orderedQuantity)
              .map((item) => (
                <li key={item.ingredientId} className="flex justify-between gap-3">
                  <span>{ingredientById.get(item.ingredientId)?.name ?? '-'}</span>
                  <span className="font-medium">
                    {formatQuantity(item.orderedQuantity - item.receivedQuantity, lineUnitName(item))}
                  </span>
                </li>
              ))}
          </ul>
          {receivingZones.length > 0 ? (
            <Select
              label="รับเข้า Zone"
              id="receive-zone"
              options={receivingZones.map((zone) => ({ value: zone._id, label: zone.name }))}
              value={selectedReceiveZoneId}
              onChange={(event) => setReceiveZoneId(event.target.value)}
            />
          ) : (
            <p className="text-sm text-danger">คุณไม่มีสิทธิ์ใน Zone ที่รับสินค้าได้ กรุณาติดต่อผู้ดูแลระบบ</p>
          )}
          <Input
            label="เลขที่บิล/ใบส่งของ (ถ้ามี)"
            id="receive-invoice-no"
            value={invoiceNo}
            onChange={(event) => setInvoiceNo(event.target.value)}
          />
        </div>
      </Modal>

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
