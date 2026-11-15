import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { suppliersApi } from '@/api/endpoints/suppliers'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Modal } from '@/components/Modal'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { ExportButton } from '@/components/ExportButton'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import type { Supplier } from '@/types/entities'

const formSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัส'),
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('อีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})
type FormValues = z.infer<typeof formSchema>

export function SuppliersPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.SUPPLIERS_CREATE)
  const canUpdate = usePermission(PERMISSIONS.SUPPLIERS_UPDATE)
  const canExport = usePermission(PERMISSIONS.SUPPLIERS_EXPORT)
  const canDelete = usePermission(PERMISSIONS.SUPPLIERS_DELETE)
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) })

  const openCreate = () => {
    reset({ code: '', name: '', contactName: '', phone: '', email: '', address: '', status: 'ACTIVE' })
    setEditing('new')
  }
  const openEdit = (supplier: Supplier) => {
    reset({
      code: supplier.code,
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      status: supplier.status,
    })
    setEditing(supplier)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = { ...values, email: values.email || undefined }
      if (editing === 'new') {
        await suppliersApi.create(payload)
        toast.show('success', 'สร้าง Supplier สำเร็จ')
      } else if (editing) {
        const { code: _code, ...rest } = payload
        await suppliersApi.update(editing._id, rest)
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const handleDelete = async () => {
    if (!deleting) {
      return
    }
    setIsDeleting(true)
    try {
      await suppliersApi.remove(deleting._id)
      toast.show('success', `ลบ Supplier ${deleting.name} แล้ว`)
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDeleting(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: Array<DataTableColumn<Supplier>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    { key: 'name', header: 'ชื่อ Supplier', render: (row) => row.name },
    { key: 'contactName', header: 'ผู้ติดต่อ', render: (row) => row.contactName || '-' },
    { key: 'phone', header: 'เบอร์โทร', render: (row) => row.phone || '-' },
    { key: 'status', header: 'สถานะ', render: (row) => <Badge color={row.status === 'ACTIVE' ? 'success' : 'gray'}>{row.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge> },
    ...(canUpdate || canDelete
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: Supplier) => (
              <div className="flex items-center gap-4">
                {canUpdate ? (
                  <button type="button" className="text-primary hover:underline" onClick={() => openEdit(row)}>
                    <Pencil className="inline size-4" /> แก้ไข
                  </button>
                ) : null}
                {canDelete ? (
                  <button type="button" className="text-danger hover:underline" onClick={() => setDeleting(row)}>
                    <Trash2 className="inline size-4" /> ลบ
                  </button>
                ) : null}
              </div>
            ),
          } satisfies DataTableColumn<Supplier>,
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Supplier</h1>
          <p className="text-sm text-text-secondary">จัดการข้อมูลผู้จำหน่ายวัตถุดิบ</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? <ExportButton onExport={(format) => suppliersApi.exportFile(format)} /> : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> เพิ่ม Supplier
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มี Supplier" />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่ม Supplier' : 'แก้ไข Supplier'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="รหัส" disabled={editing !== 'new'} error={errors.code?.message} {...register('code')} />
          <Input label="ชื่อ Supplier" error={errors.name?.message} {...register('name')} />
          <Input label="ผู้ติดต่อ" {...register('contactName')} />
          <Input label="เบอร์โทร" {...register('phone')} />
          <Input label="อีเมล" error={errors.email?.message} {...register('email')} />
          <Input label="ที่อยู่" {...register('address')} />
          {editing !== 'new' ? (
            <Select
              label="สถานะ"
              options={[
                { value: 'ACTIVE', label: 'ใช้งาน' },
                { value: 'INACTIVE', label: 'ปิดใช้งาน' },
              ]}
              {...register('status')}
            />
          ) : null}
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title="ลบ Supplier"
        message={`ลบ ${deleting?.code ?? ''} ${deleting?.name ?? ''} ออกจากระบบถาวร? ลบได้เฉพาะ Supplier ที่ยังไม่เคยมีใบสั่งซื้อหรือการรับสินค้า ถ้าเคยใช้แล้วให้เปลี่ยนสถานะเป็นปิดใช้งานแทน`}
        confirmLabel="ลบ"
        danger
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
