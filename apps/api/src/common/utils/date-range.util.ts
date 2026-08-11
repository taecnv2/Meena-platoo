/** Builds a Mongo createdAt range filter from date-only strings ('YYYY-MM-DD'), inclusive of the whole day on both ends. */
export function buildDateRangeQuery(
  dateFrom?: string,
  dateTo?: string,
): { $gte?: Date; $lte?: Date } | undefined {
  const gte = dateFrom ? startOfDay(dateFrom) : undefined;
  const lte = dateTo ? endOfDay(dateTo) : undefined;
  if (!gte && !lte) {
    return undefined;
  }
  return { ...(gte ? { $gte: gte } : {}), ...(lte ? { $lte: lte } : {}) };
}

function startOfDay(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDay(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}
