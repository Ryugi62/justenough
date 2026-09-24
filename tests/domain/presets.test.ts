// AC-20 — demo presets: each has an eligible applicant A and an applicant B who fails exactly one predicate.
import { describe, expect, it } from 'vitest';
import { DEMO_PRESETS, forgeToPass, presetFrom, type PresetId } from '../../src/domain/presets';
import { DEMO_PROGRAM, GRANT_PROGRAM, NOTICE_CLAUSES, policyFromClause } from '../../src/domain/notices';
import { explainEligibility } from '../../src/domain/eligibility';

const HANGUL = /[가-힣ㄱ-ㆎ]/;

describe('DEMO_PRESETS', () => {
  it('youth (default) is the Korean youth allowance, grant is the Web3 community grant', () => {
    expect(DEMO_PRESETS.youth.clause).toBe(DEMO_PROGRAM);
    expect(DEMO_PRESETS.grant.clause).toBe(GRANT_PROGRAM);
    expect(GRANT_PROGRAM.predicates).toEqual({ minAge: 19, maxAge: 34, sido: 11, student: true });
  });

  for (const id of ['youth', 'grant'] as PresetId[]) {
    it(`${id}: A is eligible, B fails exactly one predicate`, () => {
      const p = DEMO_PRESETS[id];
      const policy = policyFromClause(p.clause);
      expect(explainEligibility(p.applicantA, policy).eligible).toBe(true);
      const failing = explainEligibility(p.applicantB, policy).checks.filter((c) => !c.ok).map((c) => c.predicate);
      expect(failing).toEqual([id === 'grant' ? 'student' : 'unemployed']);
    });

    it(`${id}: forging B's failing field makes the values pass (the circuit must still refuse: not issued)`, () => {
      const p = DEMO_PRESETS[id];
      const policy = policyFromClause(p.clause);
      const forged = forgeToPass(p.applicantB, policy);
      expect(explainEligibility(forged, policy).eligible).toBe(true);
      const changed = (Object.keys(forged) as Array<keyof typeof forged>).filter((k) => forged[k] !== p.applicantB[k]);
      expect(changed).toEqual([id === 'grant' ? 'student' : 'employed']);
    });
  }

  it('presetFrom reads ?preset=, defaulting to youth', () => {
    expect(presetFrom('')).toBe('youth');
    expect(presetFrom('?preset=grant&lang=en')).toBe('grant');
    expect(presetFrom('?preset=nope')).toBe('youth');
  });
});

describe('English glosses (AC-18)', () => {
  it('every clause, real or synthetic, carries an English programme name and quote without Hangul', () => {
    for (const c of [...NOTICE_CLAUSES, DEMO_PROGRAM, GRANT_PROGRAM]) {
      expect(c.en.program.length, c.id).toBeGreaterThan(5);
      expect(c.en.quote.length, c.id).toBeGreaterThan(8);
      expect(c.en.notCovered).toHaveLength(c.notCovered.length);
      for (const s of [c.en.program, c.en.quote, ...c.en.notCovered]) expect(HANGUL.test(s), `${c.id}: ${s}`).toBe(false);
    }
  });
});
