/** Date helpers for the daily ledger (dates are 'YYYY-MM-DD' strings in local time, like the API's listDays). */

export const MAX_LEDGER_DAYS = 62

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Inclusive number of days between two date-only strings (0 when `to` is before `from`). */
export function countDays(dateFrom: string, dateTo: string): number {
  const diff = Math.round((parseDateOnly(dateTo).getTime() - parseDateOnly(dateFrom).getTime()) / 86_400_000)
  return diff < 0 ? 0 : diff + 1
}

const dayHeaderFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })
const weekdayFormat = new Intl.DateTimeFormat('th-TH', { weekday: 'short' })

/** "1 ต.ค." */
export function formatDayHeader(day: string): string {
  return dayHeaderFormat.format(parseDateOnly(day))
}

/** "พ." -- short weekday, helps staff spot weekends. */
export function formatWeekday(day: string): string {
  return weekdayFormat.format(parseDateOnly(day))
}

/** "01/10" -- compact label for exported column headers. */
export function formatDayShort(day: string): string {
  const [, month, date] = day.split('-')
  return `${date}/${month}`
}
