// AC-12 — the TypeScript domain rule and the compiled `meetsPolicy` circuit must agree.
// If they ever drift, the applicant screen would promise something the proof cannot deliver.
import { describe, expect, it } from 'vitest';
import { pureCircuits } from '../../contract/src/managed/justenough/contract/index.js';
import { toContractCredential, toContractPolicy } from '../../src/adapters/simulator/mapping';
import { explainEligibility, type Credential, type EligibilityPolicy } from '../../src/domain/eligibility';
import { birthRangeFor, ymd } from '../../src/domain/dates';

// Small deterministic PRNG (mulberry32) so failures are reproducible.
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('meetsPolicy circuit ≡ explainEligibility', () => {
  it('agrees on 2,000 random cases concentrated on the boundaries', () => {
    const r = rng(20260924);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
    const sidos = [11, 26, 28, 41, 48] as const;
    let eligibleCount = 0;
    for (let i = 0; i < 2000; i++) {
      const refYear = 2026 + Math.floor(r() * 3);
      const ref = ymd(refYear, 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28));
      const minAge = pick([undefined, 15, 19, 20]);
      const maxAge = pick([undefined, 29, 34, 39]);
      const policy: EligibilityPolicy = {
        ...birthRangeFor(ref, { minAge, maxAge }),
        sido: pick([0, ...sidos]),
        sigungu: 0,
        requireStudent: r() < 0.3,
        requireUnemployed: r() < 0.4,
        maxIncomePct: pick([0, 60, 100, 150]),
        referenceDate: ref,
      };
      if (policy.sido !== 0 && r() < 0.3) policy.sigungu = policy.sido * 1000 + 110;
      // births hugging the edges of the band half the time
      const edge = pick([policy.minBirthDate, policy.maxBirthDate]);
      const birth = r() < 0.5 && edge > 0 ? edge + pick([-1, 0, 1]) : ymd(1980 + Math.floor(r() * 30), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28));
      const sido = r() < 0.6 && policy.sido !== 0 ? policy.sido : pick(sidos);
      const cred: Credential = {
        birthDate: birth,
        sido,
        sigungu: r() < 0.7 && policy.sigungu !== 0 ? policy.sigungu : sido * 1000 + pick([110, 140, 650]),
        student: r() < 0.5,
        employed: r() < 0.5,
        incomePct: policy.maxIncomePct > 0 && r() < 0.5 ? policy.maxIncomePct + pick([-1, 0, 1]) : Math.floor(r() * 300),
        validUntil: r() < 0.5 ? ref + pick([-1, 0, 1]) : ref + 10000,
      };
      const ts = explainEligibility(cred, policy).eligible;
      const circuit = pureCircuits.meetsPolicy(toContractCredential(cred), toContractPolicy(policy));
      expect(circuit, JSON.stringify({ cred, policy })).toBe(ts);
      if (ts) eligibleCount++;
    }
    // the generator must exercise both outcomes, not just one
    expect(eligibleCount).toBeGreaterThan(100);
    expect(eligibleCount).toBeLessThan(1900);
  });
});
