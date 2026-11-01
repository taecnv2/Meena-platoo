import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { inventoryApi } from '@/api/endpoints/inventory'
import { productionApi, type CreateProductionPayload } from '@/api/endpoints/production'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { UnitSelect } from '@/components/UnitSelect'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getBaseUnit, getUnitOptions } from '@/utils/units'
import type { Ingredient, Unit, Zone } from '@/types/entities'
import { computeProductionPreview, type PreviewOutput } from './productionCostPreview'

const isBlank = (value: string) => value.trim() === ''
const toNumber = (value: string) => Number(value.trim())

const positiveText = (message: string) =>
  z.string().refine((value) => !isBlank(value) && Number.isFinite(toNumber(value)) && toNumber(value) > 0, message)
const optionalNonNegativeText = z
  .string()
  .refine((value) => isBlank(value) || (Number.isFinite(toNumber(value)) && toNumber(value) >= 0), 'ต้องเป็นตัวเลขที่ไม่ติดลบ')
const optionalPositiveText = z
  .string()
  .refine((value) => isBlank(value) || (Number.isFinite(toNumber(value)) && toNumber(value) > 0), 'ต้องมากกว่า 0')

const formSchema = z
  .object({
    zoneId: z.string().min(1, 'กรุณาเลือก Zone'),
    inputIngredientId: z.string().min(1, 'กรุณาเลือกวัตถุดิบตั้งต้น'),
    inputQuantity: positiveText('กรุณากรอกจำนวนที่มากกว่า 0'),
    // Optional: UnitSelect disables itself when the ingredient has a single unit, and RHF may then drop the value.
    inputUnitId: z.string().optional(),
    inputUnitCost: optionalNonNegativeText,
    outputs: z
      .array(
        z.object({
          ingredientId: z.string().min(1, 'กรุณาเลือกสินค้าที่ได้'),
          quantity: positiveText('กรุณากรอกจำนวนที่มากกว่า 0'),
          unitId: z.string().optional(),
          portionWeight: optionalPositiveText,
        }),
      )
      .min(1, 'กรุณาเพิ่มสินค้าที่ได้อย่างน้อย 1 รายการ'),
    wasteQuantity: optionalNonNegativeText,
    updateDefaultCost: z.boolean(),
    remark: z.string(),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>()
    values.outputs.forEach((output, index) => {
      if (!output.ingredientId) {
        return
      }
      if (output.ingredientId === values.inputIngredientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outputs', index, 'ingredientId'],
          message: 'ต้องไม่ใช่วัตถุดิบตั้งต้น',
        })
      } else if (seen.has(output.ingredientId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['outputs', index, 'ingredientId'], message: 'เลือกสินค้านี้ซ้ำแล้ว' })
      }
      seen.add(output.ingredientId)
    })
  })
type FormValues = z.infer<typeof formSchema>

const EMPTY_OUTPUT: FormValues['outputs'][number] = { ingredientId: '', quantity: '', unitId: '', portionWeight: '' }

const emptyForm = (zoneId: string): FormValues => ({
  zoneId,
  inputIngredientId: '',
  inputQuantity: '',
  inputUnitId: '',
  inputUnitCost: '',
  outputs: [{ ...EMPTY_OUTPUT }],
  wasteQuantity: '',
  updateDefaultCost: false,
  remark: '',
})

const optionalNumber = (value: string | undefined) => (value === undefined || isBlank(value) ? undefined : toNumber(value))

/** Query keys whose data a production batch changes (stock, movements, reports; standard cost when updated). */
const AFFECTED_QUERY_KEYS = [['production'], ['inventory'], ['stock-movements'], ['reports'], ['dashboard']]

interface ProductionFormProps {
  zones: Zone[]
  ingredients: Ingredient[]
  units: Unit[]
}

export function ProductionForm({ zones, ingredients, units }: ProductionFormProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const canReadInventory = usePermission(PERMISSIONS.INVENTORY_READ)
  // The API only lets users who may edit ingredients overwrite standard costs.
  const canUpdateCost = usePermission(PERMISSIONS.INGREDIENTS_UPDATE)

  const defaultZoneId = useMemo(() => {
    const kitchen = zones.find((zone) => zone.type === 'KITCHEN')
    return kitchen?._id ?? (zones.length === 1 ? zones[0]._id : '')
  }, [zones])

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyForm('') })
  const { fields, append, remove } = useFieldArray({ control, name: 'outputs' })
  const values = useWatch({ control })

  // Zones arrive asynchronously -- preselect the kitchen once they do, without overriding a user's pick.
  useEffect(() => {
    if (defaultZoneId && !getValues('zoneId')) {
      setValue('zoneId', defaultZoneId)
    }
  }, [defaultZoneId, getValues, setValue])

  const ingredientById = useMemo(() => new Map(ingredients.map((ingredient) => [ingredient._id, ingredient])), [ingredients])
  const activeIngredients = useMemo(
    () => ingredients.filter((ingredient) => ingredient.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [ingredients],
  )

  const raw = values.inputIngredientId ? ingredientById.get(values.inputIngredientId) : undefined
  const rawBaseUnit = getBaseUnit(raw, units)
  const rawUnitOptions = getUnitOptions(raw, units)
  const rawSelectedUnit = rawUnitOptions.find((option) => option.unitId === values.inputUnitId) ?? rawUnitOptions[0]
  const rawFactor = rawSelectedUnit?.factor ?? 1
  const inputQuantity = optionalNumber(values.inputQuantity) ?? 0
  const inputBaseQuantity = inputQuantity * rawFactor

  const { data: rawBalances } = useQuery({
    queryKey: ['inventory', 'balances', values.zoneId, values.inputIngredientId],
    queryFn: () => inventoryApi.balances({ zoneId: values.zoneId, ingredientId: values.inputIngredientId }),
    enabled: canReadInventory && Boolean(values.zoneId) && Boolean(values.inputIngredientId),
  })
  const available = rawBalances
    ? rawBalances
        .filter((row) => row.ingredientId === values.inputIngredientId && row.zoneId === values.zoneId)
        .reduce((sum, row) => sum + row.quantity, 0)
    : null

  const baseUnitIdOf = (ingredientId: string) => ingredientById.get(ingredientId)?.baseUnitId ?? ''

  const handleRawChange = (ingredientId: string) => {
    setValue('inputUnitId', baseUnitIdOf(ingredientId))
    // An output can't be the raw ingredient itself -- clear any row that now clashes.
    getValues('outputs').forEach((output, index) => {
      if (output.ingredientId && output.ingredientId === ingredientId) {
        setValue(`outputs.${index}.ingredientId`, '')
        setValue(`outputs.${index}.unitId`, '')
      }
    })
  }

  const watchedOutputs = values.outputs ?? []
  const previewRows = watchedOutputs
    .map((output, index) => {
      const ingredient = output?.ingredientId ? ingredientById.get(output.ingredientId) : undefined
      const options = getUnitOptions(ingredient, units)
      const selected = options.find((option) => option.unitId === output?.unitId) ?? options[0]
      const quantity = optionalNumber(output?.quantity) ?? 0
      return { index, ingredient, selected, baseUnit: getBaseUnit(ingredient, units), quantity, portionWeight: optionalNumber(output?.portionWeight) }
    })
    .filter((row) => row.ingredient && row.selected && row.quantity > 0)

  const unitCost = optionalNumber(values.inputUnitCost)
  const preview =
    raw && inputQuantity > 0 && previewRows.length > 0
      ? computeProductionPreview(
          {
            quantity: inputQuantity,
            factor: rawFactor,
            unitCost,
            defaultCostPerBase: raw.defaultCost,
            kgPerBaseUnit: rawBaseUnit?.type === 'WEIGHT' && rawBaseUnit.conversionFactor > 0 ? rawBaseUnit.conversionFactor : null,
          },
          previewRows.map<PreviewOutput>((row) => ({
            quantity: row.quantity,
            factor: row.selected?.factor ?? 1,
            portionWeight: row.portionWeight,
          })),
        )
      : null
  const wasteQuantity = optionalNumber(values.wasteQuantity)
  const wastePercent = wasteQuantity !== undefined && inputQuantity > 0 ? (wasteQuantity / inputQuantity) * 100 : null

  const onSubmit = async (form: FormValues) => {
    const payload: CreateProductionPayload = {
      zoneId: form.zoneId,
      inputIngredientId: form.inputIngredientId,
      inputQuantity: toNumber(form.inputQuantity),
      inputUnitId: form.inputUnitId || undefined,
      inputUnitCost: optionalNumber(form.inputUnitCost),
      outputs: form.outputs.map((output) => ({
        ingredientId: output.ingredientId,
        quantity: toNumber(output.quantity),
        unitId: output.unitId || undefined,
        portionWeight: optionalNumber(output.portionWeight),
      })),
      wasteQuantity: optionalNumber(form.wasteQuantity),
      updateDefaultCost: canUpdateCost && form.updateDefaultCost,
      remark: form.remark.trim() || undefined,
    }
    try {
      const batch = await productionApi.create(payload)
      toast.show('success', `บันทึกการแปรรูป ${batch.code} สำเร็จ`)
      reset(emptyForm(form.zoneId))
      const keys = form.updateDefaultCost ? [...AFFECTED_QUERY_KEYS, ['ingredients']] : AFFECTED_QUERY_KEYS
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const ingredientOptions = (excludeId: string | undefined) =>
    activeIngredients
      .filter((ingredient) => ingredient._id !== excludeId)
      .map((ingredient) => ({ value: ingredient._id, label: `${ingredient.name} (${ingredient.code})` }))

  const rawUnitName = rawSelectedUnit?.name ?? rawBaseUnit?.name ?? ''

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-text-primary">บันทึกการแปรรูป</h2>
      </CardHeader>
      <CardBody>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-5" noValidate>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold text-text-primary">วัตถุดิบตั้งต้น (ตัดออกจากสต๊อก)</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Zone"
                placeholder="เลือก Zone"
                options={zones.map((zone) => ({ value: zone._id, label: zone.name }))}
                error={errors.zoneId?.message}
                {...register('zoneId')}
              />
              <Select
                label="วัตถุดิบตั้งต้น"
                placeholder="เลือกวัตถุดิบ"
                options={ingredientOptions(undefined)}
                error={errors.inputIngredientId?.message}
                {...register('inputIngredientId', { onChange: (event) => handleRawChange(String(event.target.value)) })}
              />
              <Input
                label="จำนวน"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                error={errors.inputQuantity?.message}
                hint={
                  available !== null && rawBaseUnit
                    ? `คงเหลือใน Zone นี้ ${formatNumber(available)} ${rawBaseUnit.name}`
                    : undefined
                }
                {...register('inputQuantity')}
              />
              <UnitSelect
                ingredient={raw}
                units={units}
                quantity={inputQuantity}
                value={values.inputUnitId ?? ''}
                {...register('inputUnitId')}
              />
              <Input
                label="ราคาทุนต่อหน่วย (ไม่บังคับ)"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder={raw ? formatNumber(raw.defaultCost * rawFactor) : undefined}
                error={errors.inputUnitCost?.message}
                hint={
                  raw
                    ? `ค่าเริ่มต้น = ต้นทุนมาตรฐาน ${formatCurrency(raw.defaultCost * rawFactor)} ต่อ ${rawUnitName}`
                    : 'ค่าเริ่มต้น = ต้นทุนมาตรฐานของวัตถุดิบ'
                }
                {...register('inputUnitCost')}
              />
              <Input
                label={`เศษ/เสีย (ไม่บังคับ)${rawUnitName ? ` หน่วย: ${rawUnitName}` : ''}`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                error={errors.wasteQuantity?.message}
                hint="ใช้ดู Yield เท่านั้น ไม่ตัดสต๊อกเพิ่ม"
                {...register('wasteQuantity')}
              />
            </div>
            {available !== null && inputBaseQuantity > available ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-danger">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                สต๊อกใน Zone นี้ไม่พอ (ต้องใช้ {formatNumber(inputBaseQuantity)} มีอยู่ {formatNumber(available)} {rawBaseUnit?.name ?? ''})
              </p>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold text-text-primary">สินค้าที่ได้ (เพิ่มเข้าสต๊อก)</legend>
            {fields.map((field, index) => {
              const output = watchedOutputs[index]
              const ingredient = output?.ingredientId ? ingredientById.get(output.ingredientId) : undefined
              const rowErrors = errors.outputs?.[index]
              return (
                <div key={field.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-secondary">รายการที่ {index + 1}</span>
                    {fields.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded-lg p-2 text-danger hover:bg-danger-light"
                        aria-label={`ลบรายการที่ ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                      id={`outputs-${index}-ingredient`}
                      label="สินค้าที่ได้"
                      placeholder="เลือกสินค้า"
                      options={ingredientOptions(values.inputIngredientId)}
                      error={rowErrors?.ingredientId?.message}
                      {...register(`outputs.${index}.ingredientId`, {
                        onChange: (event) => setValue(`outputs.${index}.unitId`, baseUnitIdOf(String(event.target.value))),
                      })}
                    />
                    <Input
                      id={`outputs-${index}-quantity`}
                      label="จำนวน"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      error={rowErrors?.quantity?.message}
                      {...register(`outputs.${index}.quantity`)}
                    />
                    <UnitSelect
                      id={`outputs-${index}-unit`}
                      ingredient={ingredient}
                      units={units}
                      quantity={optionalNumber(output?.quantity)}
                      value={output?.unitId ?? ''}
                      {...register(`outputs.${index}.unitId`)}
                    />
                    <Input
                      id={`outputs-${index}-weight`}
                      label="น้ำหนัก/หน่วย (กรัม)"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="ไม่บังคับ"
                      error={rowErrors?.portionWeight?.message}
                      {...register(`outputs.${index}.portionWeight`)}
                    />
                  </div>
                </div>
              )
            })}
            {errors.outputs?.root?.message || errors.outputs?.message ? (
              <p className="text-sm text-danger">{errors.outputs?.root?.message ?? errors.outputs?.message}</p>
            ) : null}
            <Button type="button" variant="secondary" className="self-start" onClick={() => append({ ...EMPTY_OUTPUT })}>
              <Plus className="size-4" aria-hidden /> เพิ่มสินค้าที่ได้
            </Button>
          </fieldset>

          {preview ? (
            <section aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-primary-light bg-primary-light/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-text-primary">ประมาณการต้นทุน</h3>
                <span className="text-sm text-text-secondary">
                  ต้นทุนวัตถุดิบตั้งต้นรวม <strong className="text-text-primary">{formatCurrency(preview.totalCost)}</strong>
                </span>
              </div>
              {raw && unitCost === undefined && raw.defaultCost === 0 ? (
                <p className="text-sm text-warning">วัตถุดิบนี้ยังไม่มีต้นทุนมาตรฐาน กรอก "ราคาทุนต่อหน่วย" เพื่อคำนวณต้นทุน</p>
              ) : null}
              <p className="text-xs text-text-secondary">
                {preview.byWeight
                  ? 'แบ่งต้นทุนตามน้ำหนัก (ทุกรายการกรอกน้ำหนัก/หน่วยแล้ว)'
                  : 'แบ่งต้นทุนเท่ากันต่อหน่วย กรอก "น้ำหนัก/หน่วย" ให้ครบทุกรายการ เพื่อแบ่งต้นทุนตามน้ำหนัก'}
              </p>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-white text-sm">
                {previewRows.map((row, position) => {
                  const cost = preview.outputs[position]
                  const enteredUnit = row.selected?.name ?? ''
                  const baseUnitName = row.baseUnit?.name ?? ''
                  return (
                    <li key={row.index} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-text-primary">
                        {row.ingredient?.name} {formatNumber(row.quantity)} {enteredUnit}
                      </span>
                      <span className="text-text-secondary">
                        ต้นทุน <strong className="text-text-primary">{formatCurrency(cost.costPerEnteredUnit)}</strong> / {enteredUnit}
                        {row.selected && !row.selected.isBase ? ` (${formatCurrency(cost.costPerBaseUnit)} / ${baseUnitName})` : ''}
                        {' · '}รวม {formatCurrency(cost.totalCost)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
                {preview.yieldPercent !== null ? (
                  <span>
                    Yield <strong className="text-text-primary">{formatNumber(preview.yieldPercent)}%</strong>
                  </span>
                ) : (
                  <span>Yield คำนวณได้เมื่อวัตถุดิบตั้งต้นนับเป็นน้ำหนัก และกรอกน้ำหนัก/หน่วยครบทุกรายการ</span>
                )}
                {wastePercent !== null ? (
                  <span>
                    เศษ/เสีย <strong className="text-text-primary">{formatNumber(wastePercent)}%</strong>
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          {canUpdateCost ? (
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input type="checkbox" className="mt-0.5 size-4 rounded border-border accent-primary" {...register('updateDefaultCost')} />
              <span>
                อัปเดตต้นทุนมาตรฐานของสินค้าที่ได้
                <span className="block text-xs text-text-secondary">ใช้ต้นทุนต่อหน่วยที่คำนวณได้เป็นต้นทุนมาตรฐานใหม่ของแต่ละสินค้า</span>
              </span>
            </label>
          ) : null}

          <Input label="หมายเหตุ (ถ้ามี)" {...register('remark')} />

          <Button type="submit" isLoading={isSubmitting} className="self-start">
            บันทึกการแปรรูป
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
