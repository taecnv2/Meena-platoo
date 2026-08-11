import type { LucideIcon } from 'lucide-react'
import { Card, CardBody } from './Card'
import { cn } from '@/utils/cn'

interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  trend?: { value: number; label?: string }
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

const TONE_ICON_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
}

export function StatCard({ label, value, icon: Icon, trend, tone = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="text-2xl font-semibold text-text-primary">{value}</span>
          {trend ? (
            <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-success' : 'text-danger')}>
              {trend.value >= 0 ? '+' : ''}
              {trend.value.toFixed(1)}% {trend.label ?? ''}
            </span>
          ) : null}
        </div>
        {Icon ? (
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONE_ICON_CLASSES[tone])}>
            <Icon className="size-5" />
          </span>
        ) : null}
      </CardBody>
    </Card>
  )
}
