import { forwardRef, type SelectHTMLAttributes } from 'react'
import type { Ingredient, Unit } from '@/types/entities'
import { formatNumber } from '@/utils/format'
import { getUnitOptions } from '@/utils/units'
import { Select } from './Select'

interface UnitSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  ingredient: Ingredient | undefined
  units: Unit[] | undefined
  label?: string
  error?: string
  /** When given, shows "= 24 ขวด" under the select for a non-base unit. */
  quantity?: number
}

/**
 * Unit picker for a quantity field: the ingredient's base unit plus its pack units (ลัง/ถุง)
 * and same-scale units (g for kg). Value is a unit id; '' is never offered once an ingredient
 * is chosen, so register it with the base unit id as default.
 */
export const UnitSelect = forwardRef<HTMLSelectElement, UnitSelectProps>(
  ({ ingredient, units, label = 'หน่วย', quantity, value, disabled, ...props }, ref) => {
    const options = getUnitOptions(ingredient, units)
    const selected = options.find((option) => option.unitId === value)
    const base = options[0]
    const showPreview = selected && !selected.isBase && quantity !== undefined && quantity > 0 && base
    return (
      <div className="flex flex-col gap-1">
        <Select
          ref={ref}
          label={label}
          value={value}
          disabled={options.length <= 1 || disabled}
          options={
            options.length > 0
              ? options.map((option) => ({
                  value: option.unitId,
                  label: option.isBase
                    ? `${option.name} (หน่วยหลัก)`
                    : `${option.name} (= ${formatNumber(option.factor)} ${base?.name ?? ''})`,
                }))
              : [{ value: '', label: '-' }]
          }
          {...props}
        />
        {showPreview ? (
          <span className="text-xs text-text-secondary">
            = {formatNumber(quantity * selected.factor)} {base.name}
          </span>
        ) : null}
      </div>
    )
  },
)
UnitSelect.displayName = 'UnitSelect'
