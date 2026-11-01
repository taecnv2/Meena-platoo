import { buildLedgerBalances, listDays } from './ledger.util';

describe('listDays', () => {
  it('lists every day inclusively, across a month boundary', () => {
    expect(listDays('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });
});

describe('buildLedgerBalances', () => {
  it('rebuilds opening/closing from the current balance and rolls days forward', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03'];
    const flows = new Map([
      ['2026-10-01', { in: 10, out: 2 }],
      ['2026-10-03', { in: 0, out: 5 }],
    ]);
    // Today 20 on hand; +4 net happened after the range ended.
    const ledger = buildLedgerBalances(20, 4, days, flows);
    expect(ledger.closing).toBe(16);
    expect(ledger.opening).toBe(13);
    expect(ledger.totalIn).toBe(10);
    expect(ledger.totalOut).toBe(7);
    expect(ledger.days.map((day) => day.closing)).toEqual([21, 21, 16]);
  });
});
