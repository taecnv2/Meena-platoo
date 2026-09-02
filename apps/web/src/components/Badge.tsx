import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeColor = 'success' | 'warning' | 'danger' | 'info' | 'gray'

const COLOR_CLASSES: Record<BadgeColor, string> = {
  success: 'bg-success-light text-green-800 border border-success-border',
  warning: 'bg-warning-light text-amber-800 border border-warning-border',
  danger: 'bg-danger-light text-red-800 border border-danger-border',
  info: 'bg-info-light text-sky-800 border border-info-border',
  gray: 'bg-slate-100 text-slate-700 border border-slate-200',
}

export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', COLOR_CLASSES[color])}>
      {children}
    </span>
  )
}
