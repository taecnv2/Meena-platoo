import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'
import { exportToExcel, type ExcelColumn } from '@/utils/excel'

interface ExportButtonProps<T> {
  fileName: string
  columns: Array<ExcelColumn<T>>
  rows: T[]
  label?: string
}

/** "ส่งออก Excel" -- downloads exactly what the table on screen shows. */
export function ExportButton<T>({ fileName, columns, rows, label = 'ส่งออก Excel' }: ExportButtonProps<T>) {
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleClick = async () => {
    setIsExporting(true)
    try {
      await exportToExcel(fileName, columns, rows)
    } catch {
      toast.show('error', 'ส่งออกไฟล์ไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void handleClick()}
      isLoading={isExporting}
      disabled={rows.length === 0}
    >
      {isExporting ? null : <Download className="size-4" aria-hidden />}
      {label}
    </Button>
  )
}
