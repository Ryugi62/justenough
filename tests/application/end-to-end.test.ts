// UC-1 … UC-6 end to end: application use cases driving the compiled contract through the simulator adapter.
import { describe, expect, it } from 'vitest';
import { applyToProgram, auditDraw, claimBenefit, drawAndSelect, registerProgramFromClause } from '../../src/application/use-cases';
import { SimulatedNetwork } from '../../src/adapters/simulator/simulated-network';
import { contractTicketHasher, SimulatedHolder, SimulatedLedgerView, SimulatedOperator } from '../../src/adapters/simulator/ports';
import { toContractCredential } from '../../src/adapters/simulator/mapping';
import { DEMO_PROGRAM, NOTICE_CLAUSES } from '../../src/domain/notices';
import { ymd } from '../../src/domain/dates';
import { SIDO } from '../../src/domain/regions';
import type { Credential } from '../../src/domain/eligibility';

const bytes = (n: number) => new Uint8Array(32).fill(n);
const base: Credential = {
  birthDate: ymd(1999, 7, 7),
  sido: SIDO.SEOUL,
  sigungu: 11680,
  student: false,
  employed: false,
  incomePct: 95,
  validUntil: ymd(2027, 6, 30),
};

function world() {
  const net = SimulatedNetwork.deploy(bytes(1));
  const issuer = net.party({ secret: bytes(1) });
  const operator = new SimulatedOperator(net.party({ secret: bytes(2) }));
  const view = new SimulatedLedgerView(net);
  const wallet = (n: number, c: Credential) => {
    const p = net.party({ secret: bytes(n), credential: toContractCredential(c), salt: bytes(n + 100) });
    issuer.issueCredential(p.commitment());
    return new SimulatedHolder(p);
  };
  return { net, operator, view, wallet };
}

describe('demo lifecycle on the compiled contract', () => {
  it('register → apply (eligible / ineligible / duplicate) → draw → claim', async () => {
    const { net, operator, view, wallet } = world();
    const { programId } = await registerProgramFromClause(operator, DEMO_PROGRAM, 2);
    expect(view.program(programId)?.open).toBe(true);

    const eligible = [wallet(10, base), wallet(11, { ...base, incomePct: 140 }), wallet(12, { ...base, birthDate: ymd(2004, 1, 1) })];
    const employed = wallet(13, { ...base, employed: true });

    for (const h of eligible) expect((await applyToProgram(h, view, programId)).kind).toBe('applied');
    const rejected = await applyToProgram(employed, view, programId);
    expect(rejected.kind).toBe('ineligible');
    expect((await applyToProgram(eligible[0]!, view, programId)).kind).toBe('already-applied');
    expect(view.receipts(programId)).toHaveLength(3);

    const picked = await drawAndSelect(operator, view, contractTicketHasher, programId);
    expect(picked).toHaveLength(2);
    expect(view.program(programId)?.open).toBe(false);
    expect(view.drawSeed(programId)).toMatch(/^[0-9a-f]{64}$/);
    expect(auditDraw(view, contractTicketHasher, programId)).toMatchObject({ ok: true, unexpected: [], missing: [] });

    const outcomes = await Promise.all(eligible.map((h) => claimBenefit(h, view, programId)));
    expect(outcomes.filter((o) => o.kind === 'claimed')).toHaveLength(2);
    expect(outcomes.filter((o) => o.kind === 'not-selected')).toHaveLength(1);
    expect(view.receipts(programId).filter((r) => r.status === 'claimed')).toHaveLength(2);

    // what the operator can see: 3 receipts and counts, nothing else
    expect(net.ledger().applicantCount.lookup(Buffer.from(programId, 'hex')).read()).toBe(3n);
  });

  it('every real notice clause registers as a program on the contract', async () => {
    const { operator, view } = world();
    for (const clause of NOTICE_CLAUSES) {
      const { programId, policy } = await registerProgramFromClause(operator, clause, 10);
      expect(view.program(programId)?.policy).toEqual(policy);
    }
    expect(view.programIds()).toHaveLength(NOTICE_CLAUSES.length);
  });
});
