// AC-11 — 만 나이 (international age) is exact: the birthday on the reference date counts.
import { describe, expect, it } from 'vitest';
import { ageOn, birthRangeFor, formatYMD, isValidYMD, parseYMD, ymd } from '../../src/domain/dates';

describe('YMD value object', () => {
  it('builds and parses YYYYMMDD integers', () => {
    expect(ymd(2026, 9, 24)).toBe(20260924);
    expect(parseYMD('2026-09-24')).toBe(20260924);
    expect(formatYMD(20260924)).toBe('2026-09-24');
  });

  it('rejects impossible dates', () => {
    expect(isValidYMD(20260230)).toBe(false);
    expect(isValidYMD(20250229)).toBe(false);
    expect(isValidYMD(20240229)).toBe(true);
    expect(() => parseYMD('2026-13-01')).toThrow();
  });
});

describe('ageOn — 만 나이', () => {
  it('is one year older exactly on the birthday', () => {
    expect(ageOn(20070924, 20260923)).toBe(18);
    expect(ageOn(20070924, 20260924)).toBe(19);
  });

  it('treats 29 Feb birthdays as turning on 1 Mar in common years', () => {
    expect(ageOn(20080229, 20270228)).toBe(18);
    expect(ageOn(20080229, 20270301)).toBe(19);
  });
});

describe('birthRangeFor — age band → inclusive birth-date range', () => {
  const ref = ymd(2026, 9, 24);

  it('만 19~34세 on 2026-09-24 = born 1991-09-25 … 2007-09-24', () => {
    expect(birthRangeFor(ref, { minAge: 19, maxAge: 34 })).toEqual({
      minBirthDate: 19910925,
      maxBirthDate: 20070924,
    });
  });

  it('agrees with ageOn at both edges', () => {
    const { minBirthDate, maxBirthDate } = birthRangeFor(ref, { minAge: 19, maxAge: 34 });
    expect(ageOn(maxBirthDate, ref)).toBe(19);
    expect(ageOn(maxBirthDate + 1, ref)).toBe(18);
    expect(ageOn(minBirthDate, ref)).toBe(34);
    expect(ageOn(19910924, ref)).toBe(35);
  });

  it('open-ended bands', () => {
    expect(birthRangeFor(ref, { maxAge: 34 }).maxBirthDate).toBe(ref);
    expect(birthRangeFor(ref, { minAge: 19 }).minBirthDate).toBe(0);
  });

  it('rejects inverted bands', () => {
    expect(() => birthRangeFor(ref, { minAge: 35, maxAge: 19 })).toThrow();
  });

  it('matches ageOn around both edges for every reference day of 2027 and 2028', () => {
    const band = { minAge: 19, maxAge: 34 };
    const toYMD = (d: Date) => ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const shift = (y: number, m: number, dd: number, k: number) => toYMD(new Date(Date.UTC(y, m - 1, dd + k)));
    let checked = 0;
    for (let d = new Date(Date.UTC(2027, 0, 1)); d.getUTCFullYear() <= 2028; d.setUTCDate(d.getUTCDate() + 1)) {
      const r = toYMD(d);
      const { minBirthDate, maxBirthDate } = birthRangeFor(r, band);
      const ry = d.getUTCFullYear();
      const rm = d.getUTCMonth() + 1;
      const rd = d.getUTCDate();
      // real calendar births within ±3 days of each edge (19th and 35th anniversaries)
      for (const years of [19, 35]) {
        for (let k = -3; k <= 3; k++) {
          const b = shift(ry - years, rm, rd, k);
          const inRange = b >= minBirthDate && b <= maxBirthDate;
          const age = ageOn(b, r);
          expect(inRange, `ref ${r} birth ${b} age ${age}`).toBe(age >= 19 && age <= 34);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });
});
