import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil } from 'lucide-react'
import { rolesApi } from '@/api/endpoints/roles'
import { permissionsApi } from '@/api/endpoints/permissions'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'
import type { Role } from '@/types/entities'

const formSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อบทบาท'),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  allZoneAccess: z.boolean().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function RolesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canCreate = usePermission(PERMISSIONS.ROLES_CREATE)
  const canUpdate = usePermission(PERMISSIONS.ROLES_UPDATE)
  const [editing, setEditing] = useState<Role | 'new' | null>(null)

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list })
  const { data: permissions } = useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list })

  const permissionsByModule = useMemo(() => {
    const groups = new Map<string, typeof permissions>()
    for (const permission of permissions ?? []) {
      const list = groups.get(permission.module) ?? []
      list.push(permission)
      groups.set(permission.module, list)
    }
    return groups
  }, [permissions])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { permissions: [] } })

  const openCreate = () => {
    reset({ name: '', description: '', permissions: [], allZoneAccess: false })
    setEditing('new')
  }
  const openEdit = (role: Role) => {
    reset({ name: role.name, description: role.description, permissions: role.permissions, allZoneAccess: role.allZoneAccess })
    setEditing(role)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing === 'new') {
        await rolesApi.create(values)
        toast.show('success', 'สร้างบทบาทสำเร็จ')
      } else if (editing) {
        await rolesApi.update(editing._id, values)
        toast.show('success', 'บันทึกการแก้ไขสำเร็จ')
      }
      await queryClient.invalidateQueries({ queryKey: ['roles'] })
      setEditing(null)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<Role>> = [
    { key: 'name', header: 'ชื่อบทบาท', render: (row) => row.name },
    { key: 'description', header: 'คำอธิบาย', render: (row) => row.description || '-' },
    { key: 'permissions', header: 'จำนวนสิทธิ์', render: (row) => row.permissions.length },
    { key: 'status', header: 'สถานะ', render: (row) => <Badge color={row.status === 'ACTIVE' ? 'success' : 'gray'}>{row.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge> },
    ...(canUpdate
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: Role) => (
              <button type="button" className="text-primary hover:underline" onClick={() => openEdit(row)}>
                <Pencil className="inline size-4" /> แก้ไข
              </button>
            ),
          } satisfies DataTableColumn<Role>,
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">บทบาท</h1>
          <p className="text-sm text-text-secondary">จัดการบทบาทและสิทธิ์การใช้งาน</p>
        </div>
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> เพิ่มบทบาท
          </Button>
        ) : null}
      </div>

      <DataTable columns={columns} rows={roles ?? []} rowKey={(row) => row._id} isLoading={isLoading} emptyMessage="ยังไม่มีบทบาท" />

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มบทบาท' : 'แก้ไขบทบาท'}>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
          <Input label="ชื่อบทบาท" error={errors.name?.message} {...register('name')} />
          <Input label="คำอธิบาย" {...register('description')} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('allZoneAccess')} />
            เข้าถึงได้ทุก Zone (สำหรับ Owner)
          </label>
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-primary">สิทธิ์การใช้งาน</p>
            <Controller
              control={control}
              name="permissions"
              render={({ field }) => (
                <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-lg border border-border p-3">
                  {Array.from(permissionsByModule.entries()).map(([module, modulePermissions]) => (
                    <div key={module}>
                      <p className="mb-1 text-xs font-semibold uppercase text-text-secondary">{module}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {(modulePermissions ?? []).map((permission) => (
                          <label key={permission._id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={field.value.includes(permission.code)}
                              onChange={(event) => {
                                field.onChange(
                                  event.target.checked
                                    ? [...field.value, permission.code]
                                    : field.value.filter((code) => code !== permission.code),
                                )
                              }}
                            />
                            {permission.name}
                          </label>
                        ))}
                      </div>
                    </div>
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
    </div>
  )
}
