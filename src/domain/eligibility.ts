// Credential, EligibilityPolicy and the human-readable eligibility rule.
// `explainEligibility(...).eligible` must equal the `meetsPolicy` circuit (tests/contract/differential.test.ts).
import { ageOn, formatYMD, type YMD } from './dates';
import { districtName, sidoName } from './regions';
import type { Lang } from './lang';

export interface Credential {
  birthDate: YMD;
  sido: number;
  sigungu: number;
  student: boolean;
  employed: boolean;
  incomePct: number;
  validUntil: YMD;
}

export interface EligibilityPolicy {
  minBirthDate: YMD;
  maxBirthDate: YMD;
  sido: number; // 0 = any
  sigungu: number; // 0 = any
  requireStudent: boolean;
  requireUnemployed: boolean;
  maxIncomePct: number; // 0 = no cap
  referenceDate: YMD;
}

export type Predicate = 'age' | 'province' | 'district' | 'student' | 'unemployed' | 'income' | 'validity';

export interface Check {
  predicate: Predicate;
  ok: boolean;
  /** What the notice requires (public). */
  requirement: string;
  /** What the applicant's credential says — shown only on the applicant's own device. */
  mine: string;
}

export interface EligibilityReport {
  eligible: boolean;
  checks: Check[];
}

const TEXT = {
  ko: {
    band: (lo?: number, hi?: number) =>
      lo !== undefined && hi !== undefined ? `만 ${lo}~${hi}세` : hi !== undefined ? `만 ${hi}세 이하` : lo !== undefined ? `만 ${lo}세 이상` : '나이 제한 없음',
    ageReq: (band: string, on: string) => `${band} (${on} 기준)`,
    ageMine: (age: number) => `만 ${age}세`,
    anyRegion: '거주 지역 제한 없음',
    anyDistrict: '시군구 제한 없음',
    livesIn: (place: string) => `${place} 거주`,
    student: ['재학 여부 무관', '재학생'],
    studentMine: ['재학 아님', '재학 중'],
    unemployed: ['취업 여부 무관', '미취업'],
    employedMine: ['미취업', '취업 중'],
    noIncomeCap: '소득 제한 없음',
    incomeReq: (pct: number) => `기준 중위소득 ${pct}% 이하`,
    incomeMine: (pct: number) => `기준 중위소득 ${pct}%`,
    validReq: (on: string) => `${on}에 유효한 증명`,
    validMine: (until: string) => `${until}까지 유효`,
  },
  en: {
    band: (lo?: number, hi?: number) =>
      lo !== undefined && hi !== undefined ? `age ${lo}–${hi}` : hi !== undefined ? `age ${hi} or under` : lo !== undefined ? `age ${lo} or over` : 'no age limit',
    ageReq: (band: string, on: string) => `${band} (on ${on})`,
    ageMine: (age: number) => `age ${age}`,
    anyRegion: 'any region',
    anyDistrict: 'any district',
    livesIn: (place: string) => `lives in ${place}`,
    student: ['student or not', 'enrolled student'],
    studentMine: ['not enrolled', 'enrolled'],
    unemployed: ['employed or not', 'not employed'],
    employedMine: ['not employed', 'employed'],
    noIncomeCap: 'no income cap',
    incomeReq: (pct: number) => `household income ≤ ${pct}% of median`,
    incomeMine: (pct: number) => `${pct}% of median income`,
    validReq: (on: string) => `credential valid on ${on}`,
    validMine: (until: string) => `valid until ${until}`,
  },
} as const;

export function describeAgeBand(p: EligibilityPolicy, lang: Lang = 'ko'): string {
  const lo = p.maxBirthDate >= p.referenceDate ? undefined : ageOn(p.maxBirthDate, p.referenceDate);
  const hi = p.minBirthDate === 0 ? undefined : ageOn(p.minBirthDate, p.referenceDate);
  return TEXT[lang].band(lo, hi);
}

export function explainEligibility(c: Credential, p: EligibilityPolicy, lang: Lang = 'ko'): EligibilityReport {
  const t = TEXT[lang];
  const age = ageOn(c.birthDate, p.referenceDate);
  const checks: Check[] = [
    {
      predicate: 'age',
      ok: c.birthDate >= p.minBirthDate && c.birthDate <= p.maxBirthDate,
      requirement: t.ageReq(describeAgeBand(p, lang), formatYMD(p.referenceDate)),
      mine: t.ageMine(age),
    },
    {
      predicate: 'province',
      ok: p.sido === 0 || c.sido === p.sido,
      requirement: p.sido === 0 ? t.anyRegion : t.livesIn(sidoName(p.sido, lang)),
      mine: sidoName(c.sido, lang),
    },
    {
      predicate: 'district',
      ok: p.sigungu === 0 || c.sigungu === p.sigungu,
      requirement: p.sigungu === 0 ? t.anyDistrict : t.livesIn(districtName(p.sigungu, lang)),
      mine: districtName(c.sigungu, lang),
    },
    {
      predicate: 'student',
      ok: !p.requireStudent || c.student,
      requirement: t.student[p.requireStudent ? 1 : 0],
      mine: t.studentMine[c.student ? 1 : 0],
    },
    {
      predicate: 'unemployed',
      ok: !p.requireUnemployed || !c.employed,
      requirement: t.unemployed[p.requireUnemployed ? 1 : 0],
      mine: t.employedMine[c.employed ? 1 : 0],
    },
    {
      predicate: 'income',
      ok: p.maxIncomePct === 0 || c.incomePct <= p.maxIncomePct,
      requirement: p.maxIncomePct === 0 ? t.noIncomeCap : t.incomeReq(p.maxIncomePct),
      mine: t.incomeMine(c.incomePct),
    },
    {
      predicate: 'validity',
      ok: c.validUntil >= p.referenceDate,
      requirement: t.validReq(formatYMD(p.referenceDate)),
      mine: t.validMine(formatYMD(c.validUntil)),
    },
  ];
  return { eligible: checks.every((x) => x.ok), checks };
}
