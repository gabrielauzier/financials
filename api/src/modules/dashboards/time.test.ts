import { describe, expect, it } from 'vitest';
import {
  currentMonthWindow,
  last12Months,
  last30DaysWindow,
  monthBounds,
  periodWindow,
  previous30DaysWindow,
} from './time.js';

const iso = (d: Date) => d.toISOString();
const SP = 'America/Sao_Paulo'; // UTC-03:00, no DST
const MS_DAY = 86_400_000;

describe('last 30 days window', () => {
  it('is the 30 days ending today inclusive in America/Sao_Paulo', () => {
    // 2026-10-05 01:00Z is still 2026-10-04 22:00 local: today is the 4th.
    const w = last30DaysWindow(new Date('2026-10-05T01:00:00Z'), SP);
    expect(iso(w.from)).toBe('2026-09-05T03:00:00.000Z'); // 2026-09-05 00:00 local (D-29)
    expect(iso(w.to)).toBe('2026-10-05T03:00:00.000Z'); // 2026-10-05 00:00 local (D+1)
    expect((w.to.getTime() - w.from.getTime()) / MS_DAY).toBe(30);
  });

  it('is the 30 days ending today inclusive in UTC and uses the UTC day, not the Sao Paulo one', () => {
    const w = last30DaysWindow(new Date('2026-10-05T01:00:00Z'), 'UTC');
    expect(iso(w.from)).toBe('2026-09-06T00:00:00.000Z');
    expect(iso(w.to)).toBe('2026-10-06T00:00:00.000Z');
  });

  it('counts 30 local days across a DST change (not 720 hours)', () => {
    // New York leaves DST on 2026-11-01: that local day has 25 hours.
    const w = last30DaysWindow(new Date('2026-11-10T15:00:00Z'), 'America/New_York');
    expect(iso(w.from)).toBe('2026-10-12T04:00:00.000Z'); // 00:00 EDT (UTC-4)
    expect(iso(w.to)).toBe('2026-11-11T05:00:00.000Z'); // 00:00 EST (UTC-5)
  });
});

describe('previous 30 days window', () => {
  it('is the 30 days immediately before the current window, with no gap or overlap', () => {
    const now = new Date('2026-10-05T15:00:00Z');
    for (const zone of [SP, 'UTC']) {
      const current = last30DaysWindow(now, zone);
      const previous = previous30DaysWindow(now, zone);
      expect(previous.to.getTime()).toBe(current.from.getTime());
      expect((previous.to.getTime() - previous.from.getTime()) / MS_DAY).toBe(30);
    }
    expect(iso(previous30DaysWindow(now, SP).from)).toBe('2026-08-07T03:00:00.000Z');
  });
});

describe('12-month list', () => {
  it('is the current month plus the 11 earlier, oldest first, crossing the year boundary', () => {
    const months = last12Months(new Date('2026-02-15T12:00:00Z'), SP);
    expect(months.map((m) => m.month)).toEqual([
      '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
      '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02',
    ]);
  });

  it('has contiguous month windows in the zone (Sao Paulo and UTC)', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const sp = last12Months(now, SP);
    expect(iso(sp[11]?.from as Date)).toBe('2026-10-01T03:00:00.000Z');
    expect(iso(sp[11]?.to as Date)).toBe('2026-11-01T03:00:00.000Z');
    for (let i = 1; i < 12; i += 1) expect(sp[i]?.from.getTime()).toBe(sp[i - 1]?.to.getTime());
    const utc = last12Months(now, 'UTC');
    expect(iso(utc[0]?.from as Date)).toBe('2025-11-01T00:00:00.000Z');
  });

  it('uses the local month at the border: 02:00Z on the 1st is still the previous month in Sao Paulo', () => {
    const now = new Date('2026-11-01T02:00:00Z'); // 2026-10-31 23:00 local
    expect(last12Months(now, SP)[11]?.month).toBe('2026-10');
    expect(last12Months(now, 'UTC')[11]?.month).toBe('2026-11');
  });

  it('puts 23:30 local on the last day of a month inside that month window', () => {
    const lastNight = new Date('2026-09-30T23:30:00-03:00');
    const sep = monthBounds('2026-09', SP);
    expect(lastNight >= sep.from && lastNight < sep.to).toBe(true);
    const oct = monthBounds('2026-10', SP);
    expect(lastNight < oct.from).toBe(true);
  });
});

describe('current month and period windows', () => {
  it('current month spans the local month', () => {
    const w = currentMonthWindow(new Date('2026-10-05T12:00:00Z'), SP);
    expect(iso(w.from)).toBe('2026-10-01T03:00:00.000Z');
    expect(iso(w.to)).toBe('2026-11-01T03:00:00.000Z');
  });

  it('period is inclusive of both local dates', () => {
    const w = periodWindow('2026-10-01', '2026-10-31', SP);
    expect(iso(w?.from as Date)).toBe('2026-10-01T03:00:00.000Z');
    expect(iso(w?.to as Date)).toBe('2026-11-01T03:00:00.000Z');
    expect(periodWindow('2026-10-05', '2026-10-05', 'UTC')).toEqual({
      from: new Date('2026-10-05T00:00:00Z'),
      to: new Date('2026-10-06T00:00:00Z'),
    });
  });

  it('rejects malformed dates, impossible dates and from after to', () => {
    expect(periodWindow('2026-10-1', '2026-10-31', SP)).toBeNull();
    expect(periodWindow('2026-02-30', '2026-03-01', SP)).toBeNull();
    expect(periodWindow('2026-10-31', '2026-10-01', SP)).toBeNull();
    expect(periodWindow('abc', '2026-10-01', SP)).toBeNull();
  });
});
