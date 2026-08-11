import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeColor = 'success' | 'warning' | 'danger' | 'info' | 'gray'

const COLOR_CLASSES: Record<BadgeColor, string> = {
  success: 'bg-success-light text-green-800',
  warning: 'bg-warning-light text-amber-800',
  danger: 'bg-danger-light text-red-800',
  info: 'bg-info-light text-sky-800',
  gray: 'bg-slate-100 text-slate-700',
}

export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', COLOR_CLASSES[color])}>
      {children}
    </span>
  )
}
