import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { inventoryApi } from '@/api/endpoints/inventory'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { UnitSelect } from '@/components/UnitSelect'
import { Card, CardBody } from '@/components/Card'
import { useToast } from '@/components/Toast'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { useResetUnitOnIngredientChange } from './components/inventoryFormat'

const formSchema = z.object({
  ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
  quantityDelta: z.coerce.number().refine((value) => value !== 0, 'จำนวนที่ปรับต้องไม่เป็นศูนย์'),
  unitId: z.string().optional(),
  reason: z.string().min(1, 'กรุณาระบุเหตุผล'),
  remark: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function AdjustmentPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const accessibleZoneIds = useAccessibleZoneIds()
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })
  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i])), [ingredients])

  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { unitId: '' } })

  const selectedIngredient = ingredientMap.get(watch('ingredientId') ?? '')
  const quantityDelta = Number(watch('quantityDelta')) || 0
  useResetUnitOnIngredientChange(selectedIngredient, units, (unitId) => setValue('unitId', unitId))

  const onSubmit = async (values: FormValues) => {
    try {
      await inventoryApi.adjust({
        ingredientId: values.ingredientId,
        zoneId: values.zoneId,
        quantityDelta: values.quantityDelta,
        unitId: values.unitId || undefined,
        reason: values.reason,
        remark: values.remark?.trim() || undefined,
      })
      toast.show('success', 'ปรับปรุงสต๊อกสำเร็จ')
      reset({ ingredientId: '', zoneId: values.zoneId, quantityDelta: 0, unitId: '', reason: '', remark: '' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'balances'] }),
      ])
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">ปรับปรุงสต๊อก</h1>
        <p className="text-sm text-text-secondary">ปรับเพิ่ม/ลดจำนวนสต๊อกพร้อมระบุเหตุผล (กรอกจำนวนติดลบเพื่อปรับลด)</p>
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
              label="Zone"
              placeholder="เลือก Zone"
              options={accessibleZones.map((z) => ({ value: z._id, label: z.name }))}
              error={errors.zoneId?.message}
              {...register('zoneId')}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="จำนวนที่ปรับ (+/-)"
                type="number"
                step="0.01"
                hint="ค่าบวก = ปรับเพิ่ม, ค่าลบ = ปรับลด"
                error={errors.quantityDelta?.message}
                {...register('quantityDelta')}
              />
              <UnitSelect
                ingredient={selectedIngredient}
                units={units}
                quantity={Math.abs(quantityDelta)}
                value={watch('unitId')}
                {...register('unitId')}
              />
            </div>
            <Input label="เหตุผล" error={errors.reason?.message} {...register('reason')} />
            <Input label="หมายเหตุ" {...register('remark')} />
            <Button type="submit" isLoading={isSubmitting}>
              บันทึกการปรับปรุง
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
