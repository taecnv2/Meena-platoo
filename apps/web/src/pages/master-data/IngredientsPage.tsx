import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Upload } from 'lucide-react'
import { ingredientsApi } from '@/api/endpoints/ingredients'
import { categoriesApi } from '@/api/endpoints/categories'
import { unitsApi } from '@/api/endpoints/units'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { ExportButton } from '@/components/ExportButton'
import { ExcelExportButton } from '@/components/ExcelExportButton'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { formatCurrency, formatNumber } from '@/utils/format'
import type { ExcelColumn } from '@/utils/excel'
import type { Ingredient, Unit } from '@/types/entities'

const formSchema = z
  .object({
    code: z.string().min(1, 'กรุณากรอกรหัส'),
    name: z.string().min(1, 'กรุณากรอกชื่อ'),
    categoryId: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
    baseUnitId: z.string().min(1, 'กรุณาเลือกหน่วยหลัก'),
    minimumStock: z.coerce.number().min(0).optional(),
    maximumStock: z.coerce.number().min(0).optional(),
    defaultCost: z.coerce.number().min(0).optional(),
    description: z.string().optional(),
    unitConversions: z.array(
      z.object({
        unitId: z.string().min(1, 'กรุณาเลือกหน่วย'),
        factor: z.coerce.number().positive('ต้องมากกว่า 0'),
      }),
    ),
    tags: z.string().optional(),
    consignmentOwner: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>()
    values.unitConversions.forEach((conversion, index) => {
      if (!conversion.unitId) {
        return
      }
      if (conversion.unitId === values.baseUnitId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitConversions', index, 'unitId'], message: 'ต้องไม่ซ้ำกับหน่วยหลัก' })
      } else if (seen.has(conversion.unitId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitConversions', index, 'unitId'], message: 'เลือกหน่วยนี้ไปแล้ว' })
      }
      seen.add(conversion.unitId)
    })
  })
type FormValues = z.infer<typeof formSchema>

/** "ผัก, ของสด" -> ['ผัก', 'ของสด'] (trimmed, blanks and duplicates dropped). */
function parseTags(text: string | undefined): string[] {
  return [...new Set((text ?? '').split(',').map((tag) => tag.trim()).filter(Boolean))]
}

/** "1 ลัง = 12 ขวด, 1 แพ็ค = 6 ขวด" -- empty string when the ingredient has no pack units. */
function formatConversions(ingredient: Ingredient, unitById: Map<string, Unit>): string {
  const baseName = unitById.get(ingredient.baseUnitId)?.name ?? ''
  return (ingredient.unitConversions ?? [])
    .map((conversion) => {
      const unit = unitById.get(conversion.unitId)
      return unit ? `1 ${unit.name} = ${formatNumber(conversion.factor)} ${baseName}` : null
    })
    .filter((text): text is string => text !== null)
    .join(', ')
}

export function IngredientsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.INGREDIENTS_CREATE)
  const canUpdate = usePermission(PERMISSIONS.INGREDIENTS_UPDATE)
  const canImport = usePermission(PERMISSIONS.INGREDIENTS_IMPORT)
  const canExport = usePermission(PERMISSIONS.INGREDIENTS_EXPORT)
  const [editing, setEditing] = useState<Ingredient | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })

  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c._id, c.name])), [categories])
  const unitById = useMemo(() => new Map((units ?? []).map((u) => [u._id, u])), [units])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (data ?? []).filter((ingredient) => {
      if (categoryFilter && ingredient.categoryId !== categoryFilter) {
        return false
      }
      return !keyword || ingredient.name.toLowerCase().includes(keyword) || ingredient.code.toLowerCase().includes(keyword)
    })
  }, [data, search, categoryFilter])
  const isFiltered = search.trim() !== '' || categoryFilter !== ''

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { unitConversions: [] } })
  const { fields: conversionFields, append: appendConversion, remove: removeConversion } = useFieldArray({
    control,
    name: 'unitConversions',
  })

  const baseUnitId = watch('baseUnitId')
  const baseUnitName = unitById.get(baseUnitId)?.name ?? ''
  const selectedConversionIds = (watch('unitConversions') ?? []).map((conversion) => conversion.unitId)
  // Active units other than the base unit; a unit already saved on this ingredient stays listed even if since disabled.
  const conversionUnitOptions = (units ?? [])
    .filter((unit) => unit._id !== baseUnitId && (unit.status === 'ACTIVE' || selectedConversionIds.includes(unit._id)))
    .map((unit) => ({ value: unit._id, label: unit.name }))

  const openCreate = () => {
    reset({
      code: '',
      name: '',
      categoryId: '',
      baseUnitId: '',
      minimumStock: 0,
      maximumStock: 0,
      defaultCost: 0,
      description: '',
      unitConversions: [],
      tags: '',
      consignmentOwner: '',
    })
    setEditing('new')
  }
  const openEdit = (ingredient: Ingredient) => {
    reset({
      code: ingredient.code,
      name: ingredient.name,
      categoryId: ingredient.categoryId,
      baseUnitId: ingredient.baseUnitId,
      minimumStock: ingredient.minimumStock,
      maximumStock: ingredient.maximumStock,
      defaultCost: ingredient.defaultCost,
      description: ingredient.description,
      unitConversions: (ingredient.unitConversions ?? []).map((conversion) => ({ unitId: conversion.unitId, factor: conversion.factor })),
      tags: (ingredient.tags ?? []).join(', '),
      consignmentOwner: ingredient.consignmentOwner ?? '',
    })
    setEditing(ingredient)
  }

  const onSubmit = async (values: FormValues) => {
    const { code, tags, consignmentOwner, unitConversions, ...rest } = values
    const shared = {
      ...rest,
      unitConversions: unitConversions.map((conversion) => ({ unitId: conversion.unitId, factor: conversion.factor })),
      tags: parseTags(tags),
    }
    const owner = consignmentOwner?.trim() ?? ''
    try {
      if (editing === 'new') {
        await ingredientsApi.create({ code, ...shared, consignmentOwner: owner || undefined })
        toast.show('success', 'สร้างวัตถุดิบสำเร็จ')
      } else if (editing) {
        // null clears a previous consignment owner (= back to restaurant-owned).
        await ingredientsApi.update(editing._id, { ...shared, consignmentOwner: owner || null })
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  // Headers match the import template (features/import/ingredientImportColumns.ts) so an
  // exported file can be edited and imported back; only the largest pack unit round-trips.
  const largestPack = (row: Ingredient) =>
    (row.unitConversions ?? []).reduce<{ unitId: string; factor: number } | undefined>(
      (largest, conversion) => (!largest || conversion.factor > largest.factor ? conversion : largest),
      undefined,
    )
  const exportColumns: Array<ExcelColumn<Ingredient>> = [
    { header: 'รหัส', value: (row) => row.code, width: 14 },
    { header: 'ชื่อวัตถุดิบ', value: (row) => row.name, width: 28 },
    { header: 'หมวดหมู่', value: (row) => categoryMap.get(row.categoryId) ?? '' },
    { header: 'หน่วยหลัก', value: (row) => unitById.get(row.baseUnitId)?.name ?? '', width: 12 },
    { header: 'หน่วยแพ็ค', value: (row) => unitById.get(largestPack(row)?.unitId ?? '')?.name ?? '', width: 12 },
    { header: 'จำนวนต่อแพ็ค', value: (row) => largestPack(row)?.factor ?? null, width: 12 },
    { header: 'สต๊อกขั้นต่ำ', value: (row) => row.minimumStock, width: 12 },
    { header: 'สต๊อกสูงสุด', value: (row) => row.maximumStock, width: 12 },
    { header: 'ต้นทุนต่อหน่วยหลัก', value: (row) => row.defaultCost, width: 14 },
    { header: 'แท็ก', value: (row) => (row.tags ?? []).join(', '), width: 24 },
    { header: 'เจ้าของสินค้าฝากขาย', value: (row) => row.consignmentOwner ?? '' },
    { header: 'รายละเอียด', value: (row) => row.description ?? '', width: 24 },
    { header: 'หน่วยแพ็คทั้งหมด (อ้างอิง)', value: (row) => formatConversions(row, unitById), width: 28 },
  ]

  const columns: Array<DataTableColumn<Ingredient>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    {
      key: 'name',
      header: 'ชื่อวัตถุดิบ',
      render: (row) => (
        <div className="flex flex-col items-end gap-1 sm:items-start">
          <span>{row.name}</span>
          {row.consignmentOwner ? <Badge color="warning">ฝากขาย: {row.consignmentOwner}</Badge> : null}
        </div>
      ),
    },
    { key: 'category', header: 'หมวดหมู่', render: (row) => categoryMap.get(row.categoryId) ?? '-' },
    {
      key: 'unit',
      header: 'หน่วยนับ',
      render: (row) => {
        const conversions = formatConversions(row, unitById)
        return (
          <div className="flex flex-col items-end gap-0.5 sm:items-start">
            <span>{unitById.get(row.baseUnitId)?.name ?? '-'}</span>
            {conversions ? <span className="text-xs font-normal text-text-secondary">{conversions}</span> : null}
          </div>
        )
      },
    },
    { key: 'cost', header: 'ต้นทุน/หน่วย', render: (row) => formatCurrency(row.defaultCost) },
    { key: 'min', header: 'ขั้นต่ำ', render: (row) => formatNumber(row.minimumStock) },
    {
      key: 'tags',
      header: 'แท็ก',
      render: (row) =>
        row.tags && row.tags.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1 sm:justify-start">
            {row.tags.map((tag) => (
              <Badge key={tag} color="info">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          '-'
        ),
    },
    { key: 'status', header: 'สถานะ', render: (row) => <Badge color={row.status === 'ACTIVE' ? 'success' : 'gray'}>{row.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge> },
    ...(canUpdate
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: Ingredient) => (
              <button type="button" className="text-primary hover:underline" onClick={() => openEdit(row)}>
                <Pencil className="inline size-4" /> แก้ไข
              </button>
            ),
          } satisfies DataTableColumn<Ingredient>,
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">วัตถุดิบ</h1>
          <p className="text-sm text-text-secondary">จัดการข้อมูลวัตถุดิบทั้งหมด</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canImport ? (
            <Link
              to="/master-data/import"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-text-primary hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Upload className="size-4" aria-hidden /> นำเข้าจาก Excel
            </Link>
          ) : null}
          {canExport ? (
            <>
              <ExportButton onExport={(format) => ingredientsApi.exportFile(format)} />
              <ExcelExportButton fileName="วัตถุดิบ" columns={exportColumns} rows={filteredRows} label="Excel (แก้แล้วนำเข้ากลับได้)" />
            </>
          ) : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> เพิ่มวัตถุดิบ
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Input
            label="ค้นหา"
            id="ingredient-search"
            type="search"
            placeholder="ชื่อหรือรหัสวัตถุดิบ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            label="หมวดหมู่"
            id="ingredient-category-filter"
            placeholder="ทุกหมวดหมู่"
            options={(categories ?? []).map((c) => ({ value: c._id, label: c.name }))}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(row) => row._id}
        isLoading={isLoading}
        emptyMessage={isFiltered ? 'ไม่พบวัตถุดิบที่ตรงกับการค้นหา' : 'ยังไม่มีวัตถุดิบ'}
      />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มวัตถุดิบ' : 'แก้ไขวัตถุดิบ'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="รหัส" disabled={editing !== 'new'} error={errors.code?.message} {...register('code')} />
          <Input label="ชื่อวัตถุดิบ" error={errors.name?.message} {...register('name')} />
          <Select
            label="หมวดหมู่"
            placeholder="เลือกหมวดหมู่"
            options={(categories ?? []).map((c) => ({ value: c._id, label: c.name }))}
            error={errors.categoryId?.message}
            {...register('categoryId')}
          />
          <Select
            label="หน่วยหลัก (หน่วยที่ใช้นับสต๊อก)"
            placeholder="เลือกหน่วยหลัก"
            options={(units ?? []).map((u) => ({ value: u._id, label: u.name }))}
            error={errors.baseUnitId?.message}
            {...register('baseUnitId')}
          />

          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium text-text-primary">หน่วยแพ็ค / หน่วยแปลง</legend>
            <p className="text-sm text-text-secondary">
              ใช้เมื่อซื้อหรือเบิกเป็นแพ็ค เช่น 1 ลัง = 12 ขวด ระบบจะแปลงเป็นหน่วยหลักให้อัตโนมัติ
            </p>
            {conversionFields.map((field, index) => {
              const rowErrors = errors.unitConversions?.[index]
              return (
                <div key={field.id} className="flex items-start gap-2">
                  <span className="pt-9 text-sm text-text-secondary" aria-hidden>
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <Select
                      label="หน่วยแพ็ค"
                      id={`unitConversions-${index}-unitId`}
                      placeholder="เลือกหน่วย"
                      options={conversionUnitOptions}
                      error={rowErrors?.unitId?.message}
                      {...register(`unitConversions.${index}.unitId`)}
                    />
                  </div>
                  <span className="pt-9 text-sm text-text-secondary" aria-hidden>
                    =
                  </span>
                  <div className="w-24">
                    <Input
                      label="จำนวน"
                      id={`unitConversions-${index}-factor`}
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      error={rowErrors?.factor?.message}
                      {...register(`unitConversions.${index}.factor`)}
                    />
                  </div>
                  <span className="min-w-10 pt-9 text-sm text-text-primary">{baseUnitName || 'หน่วยหลัก'}</span>
                  <button
                    type="button"
                    onClick={() => removeConversion(index)}
                    className="mt-7 rounded-lg p-2 text-danger hover:bg-danger-light"
                    aria-label={`ลบหน่วยแพ็คแถวที่ ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )
            })}
            {baseUnitId ? (
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => appendConversion({ unitId: '', factor: 1 })}>
                <Plus className="size-4" /> เพิ่มหน่วยแพ็ค
              </Button>
            ) : (
              <p className="text-sm text-text-secondary">เลือกหน่วยหลักก่อน จึงจะเพิ่มหน่วยแพ็คได้</p>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Input label="สต๊อกขั้นต่ำ" type="number" step="0.01" {...register('minimumStock')} />
            <Input label="สต๊อกสูงสุด" type="number" step="0.01" {...register('maximumStock')} />
          </div>
          <Input label="ต้นทุนต่อหน่วยหลัก (บาท)" type="number" step="0.01" {...register('defaultCost')} />
          <Input label="แท็ก (คั่นด้วย ,)" placeholder="เช่น ผัก, ของสด" {...register('tags')} />
          <Input label="เจ้าของสินค้า (กรณีฝากขาย)" hint="เว้นว่างถ้าเป็นของร้าน" {...register('consignmentOwner')} />
          <Input label="คำอธิบาย" {...register('description')} />
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>
    </div>
  )
}
