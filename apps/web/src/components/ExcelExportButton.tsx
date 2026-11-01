import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'
import { exportToExcel, type ExcelColumn } from '@/utils/excel'

interface ExcelExportButtonProps<T> {
  fileName: string
  columns: Array<ExcelColumn<T>>
  rows: T[]
  label?: string
}

/**
 * Client-side .xlsx download of exactly what the table on screen shows. Used where the API has
 * no export endpoint (new reports, import template) and for the ingredient list, whose sheet
 * uses the import template headers so it can be edited and imported back. Server-side CSV/PDF
 * exports use ExportButton instead.
 */
export function ExcelExportButton<T>({ fileName, columns, rows, label = 'Excel' }: ExcelExportButtonProps<T>) {
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
      size="md"
      onClick={() => void handleClick()}
      isLoading={isExporting}
      disabled={rows.length === 0}
    >
      {isExporting ? null : <FileSpreadsheet className="size-4" aria-hidden />}
      {label}
    </Button>
  )
}
