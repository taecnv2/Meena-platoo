import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil } from 'lucide-react'
import { zonesApi } from '@/api/endpoints/zones'
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
import { ZONE_TYPE_LABEL } from '@/constants/labels'
import { WAREHOUSE_ZONE_CODE } from '@/constants/zones'
import { ZONE_TYPES, type Zone, type ZoneType } from '@/types/entities'

const formSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  code: z.string().min(1, 'กรุณากรอกรหัส'),
  type: z.enum(ZONE_TYPES),
  description: z.string().optional(),
  allowReceiving: z.boolean().optional(),
})
type FormValues = z.infer<typeof formSchema>

const TYPE_OPTIONS = ZONE_TYPES.map((type) => ({ value: type, label: ZONE_TYPE_LABEL[type] }))

/** The central WAREHOUSE always accepts supplier deliveries, regardless of its flag. */
const canReceive = (zone: Zone) => zone.code === WAREHOUSE_ZONE_CODE || Boolean(zone.allowReceiving)

export function ZonesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.ZONES_CREATE)
  const canUpdate = usePermission(PERMISSIONS.ZONES_UPDATE)
  const canDisable = usePermission(PERMISSIONS.ZONES_DISABLE)
  const [editing, setEditing] = useState<Zone | 'new' | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { type: 'OTHER' as ZoneType, allowReceiving: false } })

  const openCreate = () => {
    reset({ name: '', code: '', type: 'OTHER', description: '', allowReceiving: false })
    setEditing('new')
  }
  const openEdit = (zone: Zone) => {
    reset({ name: zone.name, code: zone.code, type: zone.type, description: zone.description, allowReceiving: canReceive(zone) })
    setEditing(zone)
  }

  const isWarehouse = editing !== null && editing !== 'new' && editing.code === WAREHOUSE_ZONE_CODE

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing === 'new') {
        await zonesApi.create(values)
        toast.show('success', 'สร้าง Zone สำเร็จ')
      } else if (editing) {
        await zonesApi.update(editing._id, {
          name: values.name,
          type: values.type,
          description: values.description,
          // The WAREHOUSE flag is fixed (always receives), so leave it untouched.
          ...(isWarehouse ? {} : { allowReceiving: values.allowReceiving ?? false }),
        })
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['zones'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const toggleStatus = async (zone: Zone) => {
    try {
      await zonesApi.setStatus(zone._id, zone.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      await queryClient.invalidateQueries({ queryKey: ['zones'] })
      toast.show('success', 'อัปเดตสถานะสำเร็จ')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<Zone>> = [
    { key: 'code', header: 'รหัส', render: (row) => row.code },
    { key: 'name', header: 'ชื่อ Zone', render: (row) => row.name },
    { key: 'type', header: 'ประเภท', render: (row) => ZONE_TYPE_LABEL[row.type] },
    {
      key: 'receiving',
      header: 'รับสินค้าจาก Supplier',
      render: (row) => (canReceive(row) ? <Badge color="info">รับสินค้าได้</Badge> : '-'),
    },
    { key: 'status', header: 'สถานะ', render: (row) => <Badge color={row.status === 'ACTIVE' ? 'success' : 'gray'}>{row.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-3">
          {canUpdate ? (
            <button type="button" className="text-primary hover:underline" onClick={() => openEdit(row)}>
              <Pencil className="inline size-4" /> แก้ไข
            </button>
          ) : null}
          {canDisable ? (
            <button type="button" className="text-text-secondary hover:underline" onClick={() => void toggleStatus(row)}>
              {row.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            </button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Zone</h1>
          <p className="text-sm text-text-secondary">จัดการโซนของร้าน (สามารถเพิ่มโซนใหม่ได้ตามต้องการ)</p>
        </div>
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> เพิ่ม Zone
          </Button>
        ) : null}
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มี Zone" />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่ม Zone' : 'แก้ไข Zone'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="ชื่อ Zone" error={errors.name?.message} {...register('name')} />
          <Input label="รหัส" disabled={editing !== 'new'} error={errors.code?.message} {...register('code')} />
          <Select label="ประเภท" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
          <Input label="คำอธิบาย" {...register('description')} />
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                disabled={isWarehouse}
                {...register('allowReceiving')}
              />
              รับสินค้าจาก Supplier เข้า Zone นี้ได้โดยตรง
            </label>
            <span className="pl-6 text-sm text-text-secondary">
              {isWarehouse
                ? 'คลังสินค้าหลักรับสินค้าได้เสมอ'
                : 'เช่น ห้องเย็น ที่รับของจาก Supplier เข้าโดยตรง และให้ Zone อื่นเบิกจากที่นี่ได้'}
            </span>
          </div>
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>
    </div>
  )
}
