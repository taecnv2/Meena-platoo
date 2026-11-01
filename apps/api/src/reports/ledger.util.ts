/** Per-day in/out totals for one ingredient (base unit). */
export interface DailyFlow {
  in: number;
  out: number;
}

export interface LedgerDay extends DailyFlow {
  closing: number;
}

export interface LedgerBalances {
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  days: LedgerDay[];
}

/**
 * Rebuilds the spreadsheet-style "ยอดยกมา / รับเข้า / เบิกออก / คงเหลือ" ledger from the
 * current balance by walking movements backwards: closing at the end of the range is today's
 * balance minus everything that happened after the range, and opening is that closing minus
 * the range's own net flow. Days are then rolled forward from the opening.
 */
export function buildLedgerBalances(
  currentBalance: number,
  netAfterRange: number,
  days: string[],
  flowsByDay: Map<string, DailyFlow>,
): LedgerBalances {
  let totalIn = 0;
  let totalOut = 0;
  for (const day of days) {
    const flow = flowsByDay.get(day);
    totalIn += flow?.in ?? 0;
    totalOut += flow?.out ?? 0;
  }
  const closing = round4(currentBalance - netAfterRange);
  const opening = round4(closing - (totalIn - totalOut));

  let running = opening;
  const ledgerDays = days.map((day) => {
    const flow = flowsByDay.get(day) ?? { in: 0, out: 0 };
    running = round4(running + flow.in - flow.out);
    return { in: round4(flow.in), out: round4(flow.out), closing: running };
  });

  return {
    opening,
    totalIn: round4(totalIn),
    totalOut: round4(totalOut),
    closing,
    days: ledgerDays,
  };
}

/** Inclusive list of 'YYYY-MM-DD' strings between two date-only strings. */
export function listDays(dateFrom: string, dateTo: string): string[] {
  const [fy, fm, fd] = dateFrom.split('-').map(Number);
  const [ty, tm, td] = dateTo.split('-').map(Number);
  const cursor = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const days: string[] = [];
  while (cursor <= end) {
    days.push(
      `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
