// AC-15 — real notice clauses → circuit policies. Every clause keeps its source and verbatim quote.
import { describe, expect, it } from 'vitest';
import { NOTICE_CLAUSES, policyFromClause } from '../../src/domain/notices';
import { ageOn } from '../../src/domain/dates';
import { SIDO } from '../../src/domain/regions';

describe('NOTICE_CLAUSES', () => {
  it('has at least five real clauses, each with a URL, a verbatim quote and a retrieval date', () => {
    expect(NOTICE_CLAUSES.length).toBeGreaterThanOrEqual(5);
    for (const c of NOTICE_CLAUSES) {
      expect(c.sourceUrl).toMatch(/^https:\/\//);
      expect(c.quote.length).toBeGreaterThan(8);
      expect(c.retrieved).toMatch(/^2026-\d\d-\d\d$/);
      expect(c.program.length).toBeGreaterThan(2);
    }
  });

  it('ids are unique', () => {
    const ids = NOTICE_CLAUSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('age clauses become exact birth ranges', () => {
    const c = NOTICE_CLAUSES.find((x) => x.predicates.maxAge === 34 && x.predicates.minAge === 19);
    expect(c).toBeDefined();
    const p = policyFromClause(c!);
    expect(ageOn(p.maxBirthDate, p.referenceDate)).toBe(19);
    expect(ageOn(p.minBirthDate, p.referenceDate)).toBe(34);
  });

  it('district clauses carry both province and district codes', () => {
    const c = NOTICE_CLAUSES.find((x) => x.predicates.sigungu !== undefined);
    expect(c).toBeDefined();
    const p = policyFromClause(c!);
    expect(p.sigungu).toBe(c!.predicates.sigungu);
    expect(p.sido).toBe(Math.floor(c!.predicates.sigungu! / 1000));
    expect(p.sido).toBe(SIDO.SEOUL);
  });

  it('parts a circuit cannot express are listed, never silently dropped', () => {
    const partial = NOTICE_CLAUSES.filter((x) => x.notCovered.length > 0);
    expect(partial.length).toBeGreaterThanOrEqual(1);
    for (const c of partial) for (const n of c.notCovered) expect(n.length).toBeGreaterThan(1);
  });

  it('a clause with no predicates is rejected', () => {
    expect(() =>
      policyFromClause({ ...NOTICE_CLAUSES[0]!, predicates: {} }),
    ).toThrow(/no predicate/);
  });
});
