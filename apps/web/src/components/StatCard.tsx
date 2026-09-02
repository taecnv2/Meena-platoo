import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
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
  default: 'text-white',
  success: 'bg-gradient-to-br from-green-400 to-green-600 text-white',
  warning: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
  danger: 'bg-gradient-to-br from-red-400 to-red-600 text-white',
}

export function StatCard({ label, value, icon: Icon, trend, tone = 'default' }: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : false
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  return (
    <Card interactive>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="text-2xl font-semibold text-text-primary">{value}</span>
          {trend ? (
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                isPositive ? 'bg-success-light text-success' : 'bg-danger-light text-danger',
              )}
            >
              <TrendIcon className="size-3" />
              {isPositive ? '+' : ''}
              {trend.value.toFixed(1)}% {trend.label ?? ''}
            </span>
          ) : null}
        </div>
        {Icon ? (
          <span
            className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm', TONE_ICON_CLASSES[tone])}
            style={tone === 'default' ? { backgroundImage: 'var(--gradient-primary)' } : undefined}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </CardBody>
    </Card>
  )
}
