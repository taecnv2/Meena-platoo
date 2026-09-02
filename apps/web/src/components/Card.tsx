import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface shadow-sm',
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/15',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border px-5 py-4', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}
