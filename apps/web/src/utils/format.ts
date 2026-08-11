export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value)
}

export function formatQuantity(quantity: number, unit: string): string {
  return `${formatNumber(quantity)} ${unit}`
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date)
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' })
}
