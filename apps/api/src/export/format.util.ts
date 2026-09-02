/**
 * Server-side mirrors of apps/web/src/utils/format.ts, so exported CSV/PDF cells render
 * identically to what the user sees on screen (plan.md §65 Thai localization).
 */
export function formatExportDate(
  value: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatExportDateTime(value: Date | string): string {
  return formatExportDate(value, { hour: '2-digit', minute: '2-digit' });
}

export function formatExportNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(
    value,
  );
}

export function formatExportCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(value);
}
