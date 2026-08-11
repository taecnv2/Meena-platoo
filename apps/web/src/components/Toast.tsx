import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/utils/cn'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  show: (kind: ToastKind, message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLOR_CLASSES: Record<ToastKind, string> = {
  success: 'border-success bg-success-light text-green-800',
  error: 'border-danger bg-danger-light text-red-800',
  warning: 'border-warning bg-warning-light text-amber-800',
  info: 'border-info bg-info-light text-sky-800',
}

let idCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      idCounter += 1
      const id = idCounter
      setToasts((current) => [...current, { id, kind, message }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
          {toasts.map((toast) => {
            const Icon = ICONS[toast.kind]
            return (
              <div
                key={toast.id}
                className={cn(
                  'flex w-full max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg sm:w-auto',
                  COLOR_CLASSES[toast.kind],
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">{toast.message}</span>
                <button type="button" onClick={() => dismiss(toast.id)} aria-label="ปิดการแจ้งเตือน">
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
