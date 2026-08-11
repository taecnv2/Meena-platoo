import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-11 w-full rounded-lg border bg-white px-3 text-sm text-text-primary outline-none transition-colors',
            'focus:border-primary focus:ring-2 focus:ring-primary-light',
            error ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>
    )
  },
)
Select.displayName = 'Select'
