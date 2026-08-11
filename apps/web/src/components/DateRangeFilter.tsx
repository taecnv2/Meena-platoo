import { useState } from 'react'
import { Input } from './Input'
import { Button } from './Button'
import { cn } from '@/utils/cn'
import { DATE_PRESETS, DATE_PRESET_LABEL, getPresetRange, type DatePresetKey, type DateRangeValue } from '@/utils/dateRange'

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [activePreset, setActivePreset] = useState<DatePresetKey | null>(null)

  const handlePreset = (preset: DatePresetKey) => {
    setActivePreset(preset)
    onChange(getPresetRange(preset))
  }

  const handleManualChange = (field: 'dateFrom' | 'dateTo', newValue: string) => {
    setActivePreset(null)
    onChange({ ...value, [field]: newValue || null })
  }

  const handleClear = () => {
    setActivePreset(null)
    onChange({ dateFrom: null, dateTo: null })
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePreset(preset)}
            className={cn(
              'h-9 rounded-lg border px-3 text-sm font-medium transition-colors',
              activePreset === preset
                ? 'border-primary bg-primary-light text-primary'
                : 'border-border bg-white text-text-secondary hover:bg-slate-50',
            )}
          >
            {DATE_PRESET_LABEL[preset]}
          </button>
        ))}
        {value.dateFrom || value.dateTo ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            ล้างตัวกรอง
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <Input
          type="date"
          label="ตั้งแต่วันที่"
          value={value.dateFrom ?? ''}
          max={value.dateTo ?? undefined}
          onChange={(event) => handleManualChange('dateFrom', event.target.value)}
        />
        <Input
          type="date"
          label="ถึงวันที่"
          value={value.dateTo ?? ''}
          min={value.dateFrom ?? undefined}
          onChange={(event) => handleManualChange('dateTo', event.target.value)}
        />
      </div>
    </div>
  )
}
