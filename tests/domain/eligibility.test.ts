// Domain rule: explainEligibility is the human-readable twin of the `meetsPolicy` circuit.
import { describe, expect, it } from 'vitest';
import { explainEligibility, type Credential, type EligibilityPolicy } from '../../src/domain/eligibility';
import { birthRangeFor, ymd } from '../../src/domain/dates';
import { SIDO, sidoName } from '../../src/domain/regions';

const ref = ymd(2026, 9, 24);

// Synthetic persona — no real person (rules art. 10 ① 4).
const applicantA: Credential = {
  birthDate: ymd(1999, 4, 17),
  sido: SIDO.SEOUL,
  sigungu: 11620,
  student: false,
  employed: false,
  incomePct: 120,
  validUntil: ymd(2027, 3, 31),
};

const youthSeoul: EligibilityPolicy = {
  ...birthRangeFor(ref, { minAge: 19, maxAge: 34 }),
  sido: SIDO.SEOUL,
  sigungu: 0,
  requireStudent: false,
  requireUnemployed: true,
  maxIncomePct: 150,
  referenceDate: ref,
};

describe('explainEligibility', () => {
  it('passes every predicate for an eligible applicant', () => {
    const r = explainEligibility(applicantA, youthSeoul);
    expect(r.eligible).toBe(true);
    expect(r.checks.map((c) => c.predicate)).toEqual([
      'age',
      'province',
      'district',
      'student',
      'unemployed',
      'income',
      'validity',
    ]);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  const failing: Array<[string, Partial<Credential>, string]> = [
    ['too old', { birthDate: ymd(1989, 2, 1) }, 'age'],
    ['too young', { birthDate: ymd(2008, 1, 1) }, 'age'],
    ['other province', { sido: SIDO.BUSAN, sigungu: 26110 }, 'province'],
    ['employed', { employed: true }, 'unemployed'],
    ['income above cap', { incomePct: 151 }, 'income'],
    ['expired credential', { validUntil: ymd(2026, 9, 23) }, 'validity'],
  ];
  for (const [name, patch, predicate] of failing) {
    it(`fails exactly one predicate: ${name}`, () => {
      const r = explainEligibility({ ...applicantA, ...patch }, youthSeoul);
      expect(r.eligible).toBe(false);
      expect(r.checks.filter((c) => !c.ok).map((c) => c.predicate)).toEqual([predicate]);
    });
  }

  it('district and student predicates only bite when the policy asks', () => {
    const strict = { ...youthSeoul, sigungu: 11650, requireStudent: true };
    const r = explainEligibility(applicantA, strict);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.predicate)).toEqual(['district', 'student']);
  });

  it('income cap 0 means no cap; the boundary value passes', () => {
    expect(explainEligibility({ ...applicantA, incomePct: 900 }, { ...youthSeoul, maxIncomePct: 0 }).eligible).toBe(true);
    expect(explainEligibility({ ...applicantA, incomePct: 150 }, youthSeoul).eligible).toBe(true);
  });

  it('describes requirements in Korean for the applicant screen', () => {
    const r = explainEligibility(applicantA, youthSeoul);
    const age = r.checks.find((c) => c.predicate === 'age');
    expect(age?.requirement).toContain('만 19~34세');
    expect(sidoName(SIDO.SEOUL)).toBe('서울특별시');
  });
});
