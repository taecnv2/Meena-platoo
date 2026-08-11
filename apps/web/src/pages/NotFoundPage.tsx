import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-2xl font-semibold text-text-primary">404</p>
      <p className="text-sm text-text-secondary">ไม่พบหน้าที่คุณต้องการ</p>
      <Link to="/dashboard">
        <Button>กลับหน้าหลัก</Button>
      </Link>
    </div>
  )
}
