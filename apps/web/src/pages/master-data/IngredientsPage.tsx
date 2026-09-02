import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil } from 'lucide-react'
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
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { formatCurrency } from '@/utils/format'
import type { Ingredient } from '@/types/entities'

const formSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัส'),
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  categoryId: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
  baseUnitId: z.string().min(1, 'กรุณาเลือกหน่วยนับ'),
  minimumStock: z.coerce.number().min(0).optional(),
  maximumStock: z.coerce.number().min(0).optional(),
  defaultCost: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function IngredientsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.INGREDIENTS_CREATE)
  const canUpdate = usePermission(PERMISSIONS.INGREDIENTS_UPDATE)
  const canExport = usePermission(PERMISSIONS.INGREDIENTS_EXPORT)
  const [editing, setEditing] = useState<Ingredient | 'new' | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['ingredients'], queryFn: ingredientsApi.list })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })

  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c._id, c.name])), [categories])
  const unitMap = useMemo(() => new Map((units ?? []).map((u) => [u._id, u.name])), [units])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const openCreate = () => {
    reset({ code: '', name: '', categoryId: '', baseUnitId: '', minimumStock: 0, maximumStock: 0, defaultCost: 0, description: '' })
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
    })
    setEditing(ingredient)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing === 'new') {
        await ingredientsApi.create(values)
        toast.show('success', 'สร้างวัตถุดิบสำเร็จ')
      } else if (editing) {
        const { code: _code, ...rest } = values
        await ingredientsApi.update(editing._id, rest)
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<Ingredient>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    { key: 'name', header: 'ชื่อวัตถุดิบ', render: (row) => row.name },
    { key: 'category', header: 'หมวดหมู่', render: (row) => categoryMap.get(row.categoryId) ?? '-' },
    { key: 'unit', header: 'หน่วยนับ', render: (row) => unitMap.get(row.baseUnitId) ?? '-' },
    { key: 'cost', header: 'ต้นทุน/หน่วย', render: (row) => formatCurrency(row.defaultCost) },
    { key: 'min', header: 'ขั้นต่ำ', render: (row) => row.minimumStock },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">วัตถุดิบ</h1>
          <p className="text-sm text-text-secondary">จัดการข้อมูลวัตถุดิบทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? <ExportButton onExport={(format) => ingredientsApi.exportFile(format)} /> : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> เพิ่มวัตถุดิบ
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีวัตถุดิบ" />

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
            label="หน่วยนับ"
            placeholder="เลือกหน่วยนับ"
            options={(units ?? []).map((u) => ({ value: u._id, label: u.name }))}
            error={errors.baseUnitId?.message}
            {...register('baseUnitId')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="สต๊อกขั้นต่ำ" type="number" step="0.01" {...register('minimumStock')} />
            <Input label="สต๊อกสูงสุด" type="number" step="0.01" {...register('maximumStock')} />
          </div>
          <Input label="ต้นทุนต่อหน่วย (บาท)" type="number" step="0.01" {...register('defaultCost')} />
          <Input label="คำอธิบาย" {...register('description')} />
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>
    </div>
  )
}
