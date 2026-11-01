import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { requisitionsApi } from '@/api/endpoints/requisitions'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { unitsApi } from '@/api/endpoints/units'
import { zonesApi } from '@/api/endpoints/zones'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { SearchableSelect } from '@/components/SearchableSelect'
import { UnitSelect } from '@/components/UnitSelect'
import { Card, CardBody } from '@/components/Card'
import { useToast } from '@/components/Toast'
import { useAccessibleZoneIds } from '@/hooks/useZoneAccess'
import { WAREHOUSE_ZONE_CODE } from '@/constants/zones'

const formSchema = z
  .object({
    toZoneId: z.string().min(1, 'กรุณาเลือก Zone ของคุณ'),
    fromZoneId: z.string().min(1, 'กรุณาเลือก Zone ที่ต้องการเบิก'),
    items: z
      .array(
        z.object({
          ingredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
          unitId: z.string().optional(),
          requestedQuantity: z.coerce.number().positive('กรุณากรอกจำนวนที่มากกว่า 0'),
        }),
      )
      .min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ'),
  })
  .refine((values) => values.fromZoneId !== values.toZoneId, {
    path: ['fromZoneId'],
    message: 'Zone ที่เบิกจากต้องไม่ใช่ Zone เดียวกับผู้เบิก',
  })
type FormValues = z.infer<typeof formSchema>

const EMPTY_ITEM = { ingredientId: '', unitId: '', requestedQuantity: 0 }

export function CreateRequisitionPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const accessibleZoneIds = useAccessibleZoneIds()

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })

  const accessibleZones = (zones ?? []).filter((z) => !accessibleZoneIds || accessibleZoneIds.includes(z._id))
  const warehouseZone = useMemo(() => (zones ?? []).find((z) => z.code === WAREHOUSE_ZONE_CODE), [zones])
  // Stock can be drawn from the WAREHOUSE or any zone that receives goods directly (e.g. the cold room).
  const sourceZones = useMemo(
    () => (zones ?? []).filter((z) => z.status === 'ACTIVE' && (z.code === WAREHOUSE_ZONE_CODE || z.allowReceiving)),
    [zones],
  )
  const ingredientById = useMemo(() => new Map((ingredients ?? []).map((i) => [i._id, i])), [ingredients])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { toZoneId: '', fromZoneId: '', items: [EMPTY_ITEM] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' })

  useEffect(() => {
    if (warehouseZone) {
      setValue('fromZoneId', warehouseZone._id)
    }
  }, [warehouseZone, setValue])

  const onSubmit = async (values: FormValues) => {
    try {
      const requisition = await requisitionsApi.create({
        fromZoneId: values.fromZoneId,
        toZoneId: values.toZoneId,
        items: values.items.map((item) => ({
          ingredientId: item.ingredientId,
          requestedQuantity: item.requestedQuantity,
          unitId: item.unitId || undefined,
        })),
      })
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
        <p className="text-sm text-text-secondary">สร้างใบเบิกวัตถุดิบจากคลังสินค้าหรือห้องเย็นสำหรับ Zone ของคุณ</p>
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
                label="เบิกจาก"
                placeholder="เลือก Zone ที่ต้องการเบิก"
                options={sourceZones.map((z) => ({ value: z._id, label: z.name }))}
                error={errors.fromZoneId?.message}
                {...register('fromZoneId')}
              />
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-text-primary">รายการวัตถุดิบ</p>
              {fields.map((field, index) => {
                const ingredientField = register(`items.${index}.ingredientId`)
                const ingredient = ingredientById.get(watchedItems?.[index]?.ingredientId ?? '')
                return (
                  <div key={field.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <SearchableSelect
                          label="วัตถุดิบ"
                          id={`items-${index}-ingredientId`}
                          placeholder="เลือกวัตถุดิบ"
                          options={(ingredients ?? []).map((i) => ({ value: i._id, label: `${i.name} (${i.code})` }))}
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
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="จำนวนที่ขอเบิก"
                        id={`items-${index}-requestedQuantity`}
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        error={errors.items?.[index]?.requestedQuantity?.message}
                        {...register(`items.${index}.requestedQuantity`)}
                      />
                      <Controller
                        control={control}
                        name={`items.${index}.unitId`}
                        render={({ field: unitField }) => (
                          <UnitSelect
                            id={`items-${index}-unitId`}
                            ingredient={ingredient}
                            units={units}
                            quantity={Number(watchedItems?.[index]?.requestedQuantity) || 0}
                            ref={unitField.ref}
                            name={unitField.name}
                            value={unitField.value ?? ''}
                            onChange={unitField.onChange}
                            onBlur={unitField.onBlur}
                          />
                        )}
                      />
                    </div>
                  </div>
                )
              })}
              {errors.items?.root?.message || errors.items?.message ? (
                <p className="text-sm text-danger">{errors.items?.root?.message ?? errors.items?.message}</p>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => append(EMPTY_ITEM)}>
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
