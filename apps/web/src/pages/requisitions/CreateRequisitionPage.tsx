import { useQuery } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { requisitionsApi } from '@/api/endpoints/requisitions'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Card, CardBody } from '@/components/Card'
import { useToast } from '@/components/Toast'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'

const formSchema = z.object({
  toZoneId: z.string().min(1, 'กรุณาเลือก Zone ของคุณ'),
  fromZoneId: z.string().min(1, 'กรุณาเลือก Zone ที่ต้องการเบิก'),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
        requestedQuantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
      }),
    )
    .min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ'),
})
type FormValues = z.infer<typeof formSchema>

export function CreateRequisitionPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const accessibleZoneIds = useAccessibleZoneIds()

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })

  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { toZoneId: '', fromZoneId: '', items: [{ ingredientId: '', requestedQuantity: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const onSubmit = async (values: FormValues) => {
    try {
      const requisition = await requisitionsApi.create(values)
      toast.show('success', `สร้างใบเบิก ${requisition.code} สำเร็จ`)
      navigate(`/requisitions/${requisition._id}`)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">สร้างใบเบิก</h1>
        <p className="text-sm text-text-secondary">สร้างใบเบิกวัตถุดิบสำหรับ Zone ของคุณ</p>
      </div>

      <Card className="max-w-2xl">
        <CardBody>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Zone ของคุณ (ผู้เบิก)"
                placeholder="เลือก Zone"
                options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
                error={errors.toZoneId?.message}
                {...register('toZoneId')}
              />
              <Select
                label="ต้องการเบิกจาก Zone"
                placeholder="เลือก Zone"
                options={(zones ?? []).map((z) => ({ value: z._id, label: z.name }))}
                error={errors.fromZoneId?.message}
                {...register('fromZoneId')}
              />
            </div>

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
                      label="จำนวนที่ขอเบิก"
                      type="number"
                      step="0.01"
                      error={errors.items?.[index]?.requestedQuantity?.message}
                      {...register(`items.${index}.requestedQuantity`)}
                    />
                  </div>
                  <button type="button" onClick={() => remove(index)} className="mb-2.5 p-2 text-danger" aria-label="ลบรายการ">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => append({ ingredientId: '', requestedQuantity: 0 })}>
                <Plus className="size-4" /> เพิ่มรายการ
              </Button>
            </div>

            <Button type="submit" isLoading={isSubmitting}>
              สร้างใบเบิก
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
