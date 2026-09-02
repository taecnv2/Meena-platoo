import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, KeyRound } from 'lucide-react'
import { usersApi } from '@/api/endpoints/users'
import { rolesApi } from '@/api/endpoints/roles'
import { zonesApi } from '@/api/endpoints/zones'
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
import type { UserAccount } from '@/types/entities'

const createSchema = z.object({
  username: z.string().min(3, 'อย่างน้อย 3 ตัวอักษร'),
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
  roleId: z.string().min(1, 'กรุณาเลือกบทบาท'),
  zoneIds: z.array(z.string()).optional(),
})
type CreateFormValues = z.infer<typeof createSchema>

export function UsersPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.USERS_CREATE)
  const canUpdate = usePermission(PERMISSIONS.USERS_UPDATE)
  const canDisable = usePermission(PERMISSIONS.USERS_DISABLE)
  const canExport = usePermission(PERMISSIONS.USERS_EXPORT)
  const [editing, setEditing] = useState<UserAccount | 'new' | null>(null)
  const [resettingUser, setResettingUser] = useState<UserAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list })
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list })
  const { data: defaultPasswordInfo } = useQuery({
    queryKey: ['users', 'default-password'],
    queryFn: usersApi.getDefaultPassword,
    enabled: canCreate,
  })

  const roleMap = useMemo(() => new Map((roles ?? []).map((r) => [r._id, r.name])), [roles])
  const zoneMap = useMemo(() => new Map((zones ?? []).map((z) => [z._id, z.name])), [zones])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) })

  const openCreate = () => {
    reset({ username: '', email: '', name: '', roleId: '', zoneIds: [] })
    setEditing('new')
  }
  const openEdit = (user: UserAccount) => {
    reset({ username: user.username, email: user.email, name: user.name, roleId: user.roleId, zoneIds: user.zoneIds })
    setEditing(user)
  }

  const onSubmit = async (values: CreateFormValues) => {
    try {
      if (editing === 'new') {
        await usersApi.create(values)
        toast.show('success', 'สร้างผู้ใช้งานสำเร็จ')
      } else if (editing) {
        const { username: _username, ...rest } = values
        await usersApi.update(editing._id, rest)
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const toggleStatus = async (user: UserAccount) => {
    try {
      await usersApi.setStatus(user._id, user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.show('success', 'อัปเดตสถานะสำเร็จ')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const handleResetPassword = async () => {
    if (!resettingUser || newPassword.length < 8) return
    try {
      await usersApi.resetPassword(resettingUser._id, newPassword)
      toast.show('success', 'ตั้งรหัสผ่านใหม่สำเร็จ')
      setResettingUser(null)
      setNewPassword('')
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<UserAccount>> = [
    { key: 'username', header: 'ชื่อผู้ใช้งาน', render: (row) => row.username },
    { key: 'name', header: 'ชื่อ-นามสกุล', render: (row) => row.name },
    { key: 'role', header: 'บทบาท', render: (row) => roleMap.get(row.roleId) ?? '-' },
    { key: 'zones', header: 'Zone', render: (row) => row.zoneIds.map((id) => zoneMap.get(id)).filter(Boolean).join(', ') || 'ทั้งหมด' },
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
          {canUpdate ? (
            <button type="button" className="text-text-secondary hover:underline" onClick={() => setResettingUser(row)}>
              <KeyRound className="inline size-4" /> รีเซ็ตรหัสผ่าน
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
          <h1 className="text-xl font-semibold text-text-primary">ผู้ใช้งาน</h1>
          <p className="text-sm text-text-secondary">จัดการผู้ใช้งาน บทบาท และ Zone ที่เข้าถึงได้</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? <ExportButton onExport={(format) => usersApi.exportFile(format)} /> : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> เพิ่มผู้ใช้งาน
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable columns={columns} rows={users ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีผู้ใช้งาน" />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มผู้ใช้งาน' : 'แก้ไขผู้ใช้งาน'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="ชื่อผู้ใช้งาน" disabled={editing !== 'new'} error={errors.username?.message} {...register('username')} />
          <Input label="อีเมล" error={errors.email?.message} {...register('email')} />
          <Input label="ชื่อ-นามสกุล" error={errors.name?.message} {...register('name')} />
          {editing === 'new' ? (
            <p className="rounded-lg bg-primary/5 p-3 text-sm text-text-secondary">
              ระบบจะกำหนดรหัสผ่านเริ่มต้นให้อัตโนมัติเป็น{' '}
              <span className="font-mono font-semibold">{defaultPasswordInfo?.password ?? '...'}</span>{' '}
              กรุณาแจ้งให้ผู้ใช้งานใหม่ทราบ ระบบจะบังคับให้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก
            </p>
          ) : null}
          <Select
            label="บทบาท"
            placeholder="เลือกบทบาท"
            options={(roles ?? []).map((r) => ({ value: r._id, label: r.name }))}
            error={errors.roleId?.message}
            {...register('roleId')}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-primary">Zone ที่เข้าถึงได้</p>
            <Controller
              control={control}
              name="zoneIds"
              render={({ field }) => (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  {(zones ?? []).map((zone) => (
                    <label key={zone._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value?.includes(zone._id) ?? false}
                        onChange={(event) => {
                          const current = field.value ?? []
                          field.onChange(event.target.checked ? [...current, zone._id] : current.filter((id) => id !== zone._id))
                        }}
                      />
                      {zone.name}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>
          <Button type="submit" isLoading={isSubmitting}>
            บันทึก
          </Button>
        </form>
      </Modal>

      <Modal isOpen={resettingUser !== null} onClose={() => setResettingUser(null)} title="รีเซ็ตรหัสผ่าน">
        <div className="flex flex-col gap-4">
          <Input
            label="รหัสผ่านใหม่"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            hint="อย่างน้อย 8 ตัวอักษร ผู้ใช้งานจะต้องเปลี่ยนรหัสผ่านนี้ในการเข้าสู่ระบบครั้งถัดไป"
          />
          <Button disabled={newPassword.length < 8} onClick={() => void handleResetPassword()}>
            บันทึกรหัสผ่านใหม่
          </Button>
        </div>
      </Modal>
    </div>
  )
}
