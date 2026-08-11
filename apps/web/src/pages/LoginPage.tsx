import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/api/errors'
import { getDefaultRouteForUser } from '@/constants/nav'

const loginSchema = z.object({
  username: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้งาน'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    try {
      const user = await login(values.username, values.password)
      navigate(getDefaultRouteForUser(user), { replace: true })
    } catch (error) {
      setFormError(getErrorMessage(error, 'เข้าสู่ระบบไม่สำเร็จ'))
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">เข้าสู่ระบบ</h1>
        <p className="text-sm text-text-secondary">Meena Inventory</p>
      </div>
      <Input
        label="ชื่อผู้ใช้งาน"
        autoComplete="username"
        autoFocus
        error={errors.username?.message}
        {...register('username')}
      />
      <Input
        label="รหัสผ่าน"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
        เข้าสู่ระบบ
      </Button>
    </form>
  )
}
