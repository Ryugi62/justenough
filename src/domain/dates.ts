// YMD value object (YYYYMMDD integer) and 만 나이 (international age) rules.
// Integers keep the circuit cheap: comparing two YYYYMMDD numbers orders dates correctly.

export type YMD = number;

export function ymd(year: number, month: number, day: number): YMD {
  return year * 10000 + month * 100 + day;
}

export function splitYMD(d: YMD): { year: number; month: number; day: number } {
  return { year: Math.floor(d / 10000), month: Math.floor((d % 10000) / 100), day: d % 100 };
}

export function isValidYMD(d: YMD): boolean {
  if (!Number.isInteger(d) || d < 10000101 || d > 99991231) return false;
  const { year, month, day } = splitYMD(d);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

export function parseYMD(s: string): YMD {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${s}`);
  const d = ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  if (!isValidYMD(d)) throw new Error(`Impossible date: ${s}`);
  return d;
}

export function formatYMD(d: YMD): string {
  const { year, month, day } = splitYMD(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 만 나이 on `reference`: completed years; the birthday itself counts (민법 제158조). */
export function ageOn(birth: YMD, reference: YMD): number {
  const b = splitYMD(birth);
  const r = splitYMD(reference);
  const hadBirthday = r.month * 100 + r.day >= b.month * 100 + b.day;
  return r.year - b.year - (hadBirthday ? 0 : 1);
}

export interface AgeBand {
  minAge?: number;
  maxAge?: number;
}

/**
 * Inclusive birth-date range for "만 minAge세 이상 · 만 maxAge세 이하" on `reference`.
 * - age ≥ minAge  ⇔ birth ≤ (refYear − minAge)·10000 + refMMDD
 * - age ≤ maxAge  ⇔ birth >  (refYear − maxAge − 1)·10000 + refMMDD
 * The bounds may name a non-existent day (e.g. 29 Feb in a common year); as integer bounds
 * they still order real dates correctly, which is all the circuit needs.
 */
export function birthRangeFor(reference: YMD, band: AgeBand): { minBirthDate: YMD; maxBirthDate: YMD } {
  const { year } = splitYMD(reference);
  const mmdd = reference % 10000;
  if (band.minAge !== undefined && band.maxAge !== undefined && band.minAge > band.maxAge) {
    throw new Error(`Empty age band: ${band.minAge} > ${band.maxAge}`);
  }
  const maxBirthDate = band.minAge === undefined ? reference : (year - band.minAge) * 10000 + mmdd;
  const minBirthDate = band.maxAge === undefined ? 0 : (year - band.maxAge - 1) * 10000 + mmdd + 1;
  return { minBirthDate, maxBirthDate };
}
