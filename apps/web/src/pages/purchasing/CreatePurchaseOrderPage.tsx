import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { purchasingApi } from '@/api/endpoints/purchasing'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { unitsApi } from '@/api/endpoints/units'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { UnitSelect } from '@/components/UnitSelect'
import { Card, CardBody } from '@/components/Card'
import { useToast } from '@/components/Toast'
import { formatCurrency } from '@/utils/format'

const formSchema = z.object({
  supplierId: z.string().min(1, 'กรุณาเลือก Supplier'),
  remark: z.string().optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
        unitId: z.string().optional(),
        orderedQuantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
        unitCost: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
      }),
    )
    .min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ'),
})
type FormValues = z.infer<typeof formSchema>

const EMPTY_ITEM = { ingredientId: '', unitId: '', orderedQuantity: 0, unitCost: 0 }

export function CreatePurchaseOrderPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })

  const ingredientById = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i])), [ingredients])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { supplierId: '', remark: '', items: [EMPTY_ITEM] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' })

  const lineTotal = (index: number) => {
    const item = watchedItems?.[index]
    return (Number(item?.orderedQuantity) || 0) * (Number(item?.unitCost) || 0)
  }
  const grandTotal = fields.reduce((sum, _field, index) => sum + lineTotal(index), 0)

  const onSubmit = async (values: FormValues) => {
    try {
      const purchaseOrder = await purchasingApi.create({
        supplierId: values.supplierId,
        remark: values.remark,
        items: values.items.map((item) => ({
          ingredientId: item.ingredientId,
          orderedQuantity: item.orderedQuantity,
          unitCost: item.unitCost,
          unitId: item.unitId || undefined,
        })),
      })
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
              {fields.map((field, index) => {
                const ingredientField = register(`items.${index}.ingredientId`)
                const ingredient = ingredientById.get(watchedItems?.[index]?.ingredientId ?? '')
                return (
                  <div key={field.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Select
                          label="วัตถุดิบ"
                          id={`items-${index}-ingredientId`}
                          placeholder="เลือกวัตถุดิบ"
                          options={(ingredients ?? []).map((i) => ({ value: i._id, label: i.name }))}
                          error={errors.items?.[index]?.ingredientId?.message}
                          {...ingredientField}
                          onChange={(event) => {
                            void ingredientField.onChange(event)
                            // A new ingredient has different units: start again from its base unit.
                            setValue(`items.${index}.unitId`, ingredientById.get(event.target.value)?.baseUnitId ?? '')
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="mb-1 rounded-lg p-2.5 text-danger hover:bg-danger-light"
                        aria-label={`ลบรายการที่ ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Input
                        label="จำนวนที่สั่งซื้อ"
                        id={`items-${index}-orderedQuantity`}
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        error={errors.items?.[index]?.orderedQuantity?.message}
                        {...register(`items.${index}.orderedQuantity`)}
                      />
                      <Controller
                        control={control}
                        name={`items.${index}.unitId`}
                        render={({ field: unitField }) => (
                          <UnitSelect
                            id={`items-${index}-unitId`}
                            label="หน่วยที่สั่ง"
                            ingredient={ingredient}
                            units={units}
                            quantity={Number(watchedItems?.[index]?.orderedQuantity) || 0}
                            ref={unitField.ref}
                            name={unitField.name}
                            value={unitField.value ?? ''}
                            onChange={unitField.onChange}
                            onBlur={unitField.onBlur}
                          />
                        )}
                      />
                      <div className="col-span-2 sm:col-span-1">
                        <Input
                          label="ราคาต่อหน่วยที่สั่ง (บาท)"
                          id={`items-${index}-unitCost`}
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          error={errors.items?.[index]?.unitCost?.message}
                          {...register(`items.${index}.unitCost`)}
                        />
                      </div>
                    </div>
                    <p className="text-right text-sm text-text-secondary">
                      รวม <span className="font-medium text-text-primary">{formatCurrency(lineTotal(index))}</span>
                    </p>
                  </div>
                )
              })}
              {errors.items?.root?.message || errors.items?.message ? (
                <p className="text-sm text-danger">{errors.items?.root?.message ?? errors.items?.message}</p>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => append(EMPTY_ITEM)}>
                <Plus className="size-4" /> เพิ่มรายการ
              </Button>
              <p className="text-right text-sm text-text-secondary">
                มูลค่ารวมทั้งใบ <span className="text-base font-semibold text-text-primary">{formatCurrency(grandTotal)}</span>
              </p>
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
