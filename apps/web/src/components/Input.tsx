import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, className, id, ...props }, ref) => {
  const inputId = id ?? props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-11 w-full rounded-lg border bg-white px-3 text-sm text-text-primary outline-none transition-colors',
          'placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary-light',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-sm text-danger">{error}</span> : hint ? <span className="text-sm text-text-secondary">{hint}</span> : null}
    </div>
  )
})
Input.displayName = 'Input'
