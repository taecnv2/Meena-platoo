import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil } from 'lucide-react'
import { categoriesApi } from '@/api/endpoints/categories'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { ExportButton } from '@/components/ExportButton'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import type { Category } from '@/types/entities'

const formSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัส'),
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.CATEGORIES_CREATE)
  const canUpdate = usePermission(PERMISSIONS.CATEGORIES_UPDATE)
  const canExport = usePermission(PERMISSIONS.CATEGORIES_EXPORT)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const openCreate = () => {
    reset({ code: '', name: '', description: '' })
    setEditing('new')
  }
  const openEdit = (category: Category) => {
    reset({ code: category.code, name: category.name, description: category.description })
    setEditing(category)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing === 'new') {
        await categoriesApi.create(values)
        toast.show('success', 'สร้างหมวดหมู่สำเร็จ')
      } else if (editing) {
        await categoriesApi.update(editing._id, { name: values.name, description: values.description })
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<Category>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    { key: 'name', header: 'ชื่อหมวดหมู่', render: (row) => row.name },
    { key: 'status', header: 'สถานะ', render: (row) => <Badge color={row.status === 'ACTIVE' ? 'success' : 'gray'}>{row.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge> },
    ...(canUpdate
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: Category) => (
              <button type="button" className="text-primary hover:underline" onClick={() => openEdit(row)}>
                <Pencil className="inline size-4" /> แก้ไข
              </button>
            ),
          } satisfies DataTableColumn<Category>,
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">หมวดหมู่</h1>
          <p className="text-sm text-text-secondary">จัดการหมวดหมู่วัตถุดิบ</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? <ExportButton onExport={(format) => categoriesApi.exportFile(format)} /> : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> เพิ่มหมวดหมู่
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีหมวดหมู่" />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มหมวดหมู่' : 'แก้ไขหมวดหมู่'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="รหัส" disabled={editing !== 'new'} error={errors.code?.message} {...register('code')} />
          <Input label="ชื่อหมวดหมู่" error={errors.name?.message} {...register('name')} />
          <Input label="คำอธิบาย" {...register('description')} />
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>
    </div>
  )
}
