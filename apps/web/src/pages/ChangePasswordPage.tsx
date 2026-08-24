import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/features/auth/AuthContext'
import { authApi } from '@/api/endpoints/auth'
import { getErrorMessage } from '@/api/errors'
import { getDefaultRouteForUser } from '@/constants/nav'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
    newPassword: z.string().min(8, 'อย่างน้อย 8 ตัวอักษร'),
    confirmPassword: z.string().min(1, 'กรุณายืนยันรหัสผ่านใหม่'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
    path: ['newPassword'],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export function ChangePasswordPage() {
  const { user, completePasswordChange } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setFormError(null)
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword)
      completePasswordChange()
      navigate(user ? getDefaultRouteForUser(user) : '/', { replace: true })
    } catch (error) {
      setFormError(getErrorMessage(error, 'เปลี่ยนรหัสผ่านไม่สำเร็จ'))
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">เปลี่ยนรหัสผ่าน</h1>
        <p className="text-sm text-text-secondary">กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งานระบบ</p>
      </div>
      <Input
        label="รหัสผ่านปัจจุบัน"
        type="password"
        autoComplete="current-password"
        autoFocus
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="รหัสผ่านใหม่"
        type="password"
        autoComplete="new-password"
        hint="อย่างน้อย 8 ตัวอักษร"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="ยืนยันรหัสผ่านใหม่"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
        เปลี่ยนรหัสผ่าน
      </Button>
    </form>
  )
}
