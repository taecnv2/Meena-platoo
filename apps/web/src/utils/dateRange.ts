export type DatePresetKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'

export interface DateRangeValue {
  dateFrom: string | null
  dateTo: string | null
}

export const DATE_PRESETS: DatePresetKey[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth']

export const DATE_PRESET_LABEL: Record<DatePresetKey, string> = {
  today: 'วันนี้',
  yesterday: 'เมื่อวาน',
  thisWeek: 'อาทิตย์นี้',
  lastWeek: 'อาทิตย์ที่แล้ว',
  thisMonth: 'เดือนนี้',
  lastMonth: 'เดือนที่แล้ว',
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

/** Monday-based start of week to match Thai business-week convention. */
function startOfWeek(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7
  return addDays(date, -daysSinceMonday)
}

export function getPresetRange(preset: DatePresetKey): DateRangeValue {
  const now = new Date()
  switch (preset) {
    case 'today': {
      const value = toDateOnly(now)
      return { dateFrom: value, dateTo: value }
    }
    case 'yesterday': {
      const value = toDateOnly(addDays(now, -1))
      return { dateFrom: value, dateTo: value }
    }
    case 'thisWeek': {
      const start = startOfWeek(now)
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(addDays(start, 6)) }
    }
    case 'lastWeek': {
      const start = addDays(startOfWeek(now), -7)
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(addDays(start, 6)) }
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(end) }
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { dateFrom: toDateOnly(start), dateTo: toDateOnly(end) }
    }
  }
}
