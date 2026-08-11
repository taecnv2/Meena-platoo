import { AxiosError } from 'axios'

interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  error: string
}

export function getErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(', ') : body.message
    }
    if (error.message) {
      return error.message
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}
