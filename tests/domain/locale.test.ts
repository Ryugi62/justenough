// AC-18 — domain texts in English: eligibility explanations and region names carry no Hangul in `en`.
import { describe, expect, it } from 'vitest';
import { describeAgeBand, explainEligibility } from '../../src/domain/eligibility';
import { districtName, sidoName, SIDO } from '../../src/domain/regions';
import { DEMO_PRESETS } from '../../src/domain/presets';
import { NOTICE_CLAUSES, policyFromClause } from '../../src/domain/notices';

const HANGUL = /[가-힣ㄱ-ㆎ]/;

describe('locale', () => {
  it('Korean stays the default', () => {
    expect(sidoName(SIDO.SEOUL)).toBe('서울특별시');
    expect(districtName(11620)).toBe('서울 관악구');
  });

  it('English region names', () => {
    expect(sidoName(SIDO.SEOUL, 'en')).toBe('Seoul');
    expect(districtName(11620, 'en')).toBe('Gwanak-gu, Seoul');
    expect(districtName(41110, 'en')).toBe('Suwon, Gyeonggi-do');
    expect(districtName(99999, 'en')).toBe('district 99999');
    for (const code of Object.values(SIDO)) expect(HANGUL.test(sidoName(code, 'en')), String(code)).toBe(false);
  });

  it('English age bands', () => {
    const p = policyFromClause(DEMO_PRESETS.youth.clause);
    expect(describeAgeBand(p, 'en')).toBe('age 19–34');
    expect(describeAgeBand(p)).toBe('만 19~34세');
  });

  it('every check of every clause explains itself in English without Hangul', () => {
    const a = DEMO_PRESETS.youth.applicantA;
    for (const clause of [...NOTICE_CLAUSES, DEMO_PRESETS.youth.clause, DEMO_PRESETS.grant.clause]) {
      const en = explainEligibility(a, policyFromClause(clause), 'en');
      const ko = explainEligibility(a, policyFromClause(clause));
      expect(en.eligible).toBe(ko.eligible);
      for (const c of en.checks) {
        expect(HANGUL.test(c.requirement), c.requirement).toBe(false);
        expect(HANGUL.test(c.mine), c.mine).toBe(false);
      }
    }
  });
});
