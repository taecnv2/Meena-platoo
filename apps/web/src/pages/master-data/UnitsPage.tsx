import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil } from 'lucide-react'
import { unitsApi } from '@/api/endpoints/units'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { UNIT_TYPE_LABEL } from '@/constants/labels'
import { UNIT_TYPES, type Unit, type UnitType } from '@/types/entities'

const formSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัส'),
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  type: z.enum(UNIT_TYPES),
  conversionFactor: z.coerce.number().positive().optional(),
})
type FormValues = z.infer<typeof formSchema>

const TYPE_OPTIONS = UNIT_TYPES.map((type) => ({ value: type, label: UNIT_TYPE_LABEL[type] }))

export function UnitsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.UNITS_CREATE)
  const canUpdate = usePermission(PERMISSIONS.UNITS_UPDATE)
  const [editing, setEditing] = useState<Unit | 'new' | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['units'], queryFn: unitsApi.list })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { type: 'WEIGHT' as UnitType } })

  const openCreate = () => {
    reset({ code: '', name: '', type: 'WEIGHT', conversionFactor: 1 })
    setEditing('new')
  }
  const openEdit = (unit: Unit) => {
    reset({ code: unit.code, name: unit.name, type: unit.type, conversionFactor: unit.conversionFactor })
    setEditing(unit)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing === 'new') {
        await unitsApi.create(values)
        toast.show('success', 'สร้างหน่วยนับสำเร็จ')
      } else if (editing) {
        await unitsApi.update(editing._id, { name: values.name, type: values.type, conversionFactor: values.conversionFactor })
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['units'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<Unit>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    { key: 'name', header: 'ชื่อหน่วยนับ', render: (row) => row.name },
    { key: 'type', header: 'ประเภท', render: (row) => UNIT_TYPE_LABEL[row.type] },
    { key: 'status', header: 'สถานะ', render: (row) => <Badge color={row.status === 'ACTIVE' ? 'success' : 'gray'}>{row.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge> },
    ...(canUpdate
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: Unit) => (
              <button type="button" className="text-primary hover:underline" onClick={() => openEdit(row)}>
                <Pencil className="inline size-4" /> แก้ไข
              </button>
            ),
          } satisfies DataTableColumn<Unit>,
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">หน่วยนับ</h1>
          <p className="text-sm text-text-secondary">จัดการหน่วยนับวัตถุดิบ</p>
        </div>
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> เพิ่มหน่วยนับ
          </Button>
        ) : null}
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีหน่วยนับ" />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มหน่วยนับ' : 'แก้ไขหน่วยนับ'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="รหัส" disabled={editing !== 'new'} error={errors.code?.message} {...register('code')} />
          <Input label="ชื่อหน่วยนับ" error={errors.name?.message} {...register('name')} />
          <Select label="ประเภท" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
          <Input label="ตัวคูณเทียบหน่วยหลัก" type="number" step="0.01" error={errors.conversionFactor?.message} {...register('conversionFactor')} />
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>
    </div>
  )
}
