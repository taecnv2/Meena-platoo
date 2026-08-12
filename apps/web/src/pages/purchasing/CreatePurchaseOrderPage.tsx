import { useQuery } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Card, CardBody } from '@/components/Card'
import { useToast } from '@/components/Toast'

const formSchema = z.object({
  supplierId: z.string().min(1, 'กรุณาเลือก Supplier'),
  remark: z.string().optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
        orderedQuantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
        unitCost: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
      }),
    )
    .min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ'),
})
type FormValues = z.infer<typeof formSchema>

export function CreatePurchaseOrderPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { supplierId: '', remark: '', items: [{ ingredientId: '', orderedQuantity: 0, unitCost: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const onSubmit = async (values: FormValues) => {
    try {
      const purchaseOrder = await purchasingApi.create(values)
      toast.show('success', `สร้างใบสั่งซื้อ ${purchaseOrder.code} สำเร็จ`)
      navigate(`/purchasing/${purchaseOrder._id}`)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">สร้างใบสั่งซื้อ</h1>
        <p className="text-sm text-text-secondary">สั่งซื้อวัตถุดิบจาก Supplier เพื่อรับเข้าคลังสินค้า</p>
      </div>

      <Card className="max-w-2xl">
        <CardBody>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
            <Select
              label="Supplier"
              placeholder="เลือก Supplier"
              options={(suppliers ?? []).map((s) => ({ value: s._id, label: s.name }))}
              error={errors.supplierId?.message}
              {...register('supplierId')}
            />

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-text-primary">รายการวัตถุดิบ</p>
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
                      label="จำนวนที่สั่งซื้อ"
                      type="number"
                      step="0.01"
                      error={errors.items?.[index]?.orderedQuantity?.message}
                      {...register(`items.${index}.orderedQuantity`)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      label="ราคาต่อหน่วย"
                      type="number"
                      step="0.01"
                      error={errors.items?.[index]?.unitCost?.message}
                      {...register(`items.${index}.unitCost`)}
                    />
                  </div>
                  <button type="button" onClick={() => remove(index)} className="mb-2.5 p-2 text-danger" aria-label="ลบรายการ">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => append({ ingredientId: '', orderedQuantity: 0, unitCost: 0 })}>
                <Plus className="size-4" /> เพิ่มรายการ
              </Button>
            </div>

            <Input label="หมายเหตุ (ถ้ามี)" {...register('remark')} />

            <Button type="submit" isLoading={isSubmitting}>
              สร้างใบสั่งซื้อ
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
