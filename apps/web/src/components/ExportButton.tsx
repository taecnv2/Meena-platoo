import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'
import { getErrorMessage } from '@/api/errors'

type ExportFormat = 'csv' | 'pdf'

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>
}

export function ExportButton({ onExport }: ExportButtonProps) {
  const toast = useToast()
  const [loading, setLoading] = useState<ExportFormat | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setLoading(format)
    try {
      await onExport(format)
    } catch (error) {
      toast.show('error', getErrorMessage(error))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="md" isLoading={loading === 'csv'} disabled={loading !== null} onClick={() => void handleExport('csv')}>
        <FileSpreadsheet className="size-4" /> CSV
      </Button>
      <Button variant="secondary" size="md" isLoading={loading === 'pdf'} disabled={loading !== null} onClick={() => void handleExport('pdf')}>
        <FileText className="size-4" /> PDF
      </Button>
    </div>
  )
}
