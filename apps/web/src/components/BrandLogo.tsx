import { cn } from '@/utils/cn'

export type BrandLogoVariant = 'full' | 'compact' | 'mobile' | 'sidebar'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  className?: string
}

/**
 * Placeholder brand mark for Meena Platoo. Swap the mark markup below for the real
 * logo asset later without touching any layout that renders <BrandLogo />.
 */
export function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  const mark = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
      MP
    </span>
  )

  if (variant === 'compact' || variant === 'mobile') {
    return <div className={cn('flex items-center', className)}>{mark}</div>
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {mark}
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-text-primary">Meena Platoo</span>
        {variant === 'full' ? <span className="text-xs text-text-secondary">ระบบจัดการสต๊อก</span> : null}
      </div>
    </div>
  )
}
