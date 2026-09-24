// UC-2 … UC-6 with in-memory fakes (no Midnight runtime): the application layer decides
// *whether* to send a transaction; the contract decides whether it is valid.
import { describe, expect, it } from 'vitest';
import {
  applyToProgram,
  auditDraw,
  claimBenefit,
  drawAndSelect,
  registerProgramFromClause,
} from '../../src/application/use-cases';
import type { DrawTicketHasher, HolderPort, OperatorPort, PublicLedgerView, ReceiptStatus } from '../../src/application/ports';
import { NOTICE_CLAUSES, policyFromClause } from '../../src/domain/notices';
import type { Credential, EligibilityPolicy } from '../../src/domain/eligibility';
import { birthRangeFor, ymd } from '../../src/domain/dates';

const REF = ymd(2026, 9, 24);
const policy: EligibilityPolicy = {
  ...birthRangeFor(REF, { minAge: 19, maxAge: 34 }),
  sido: 11,
  sigungu: 0,
  requireStudent: false,
  requireUnemployed: true,
  maxIncomePct: 150,
  referenceDate: REF,
};
const eligible: Credential = {
  birthDate: ymd(2000, 1, 2),
  sido: 11,
  sigungu: 11620,
  student: false,
  employed: false,
  incomePct: 100,
  validUntil: ymd(2027, 1, 1),
};

class FakeLedger implements PublicLedgerView {
  programs = new Map<string, { policy: EligibilityPolicy; capacity: number; open: boolean }>();
  receiptsByProgram = new Map<string, Map<string, ReceiptStatus>>();
  seeds = new Map<string, string>();
  sent: string[] = [];
  drawSeed(id: string) {
    return this.seeds.get(id);
  }
  program(id: string) {
    const p = this.programs.get(id);
    return p ? { id, policy: p.policy, capacity: p.capacity, open: p.open } : undefined;
  }
  receipts(id: string) {
    return [...(this.receiptsByProgram.get(id) ?? new Map()).entries()].map(([receipt, status]) => ({ receipt, status }));
  }
}

function fakeOperator(l: FakeLedger): OperatorPort {
  return {
    async registerProgram(id, p, capacity) {
      l.sent.push(`register:${id}`);
      l.programs.set(id, { policy: p, capacity, open: true });
      l.receiptsByProgram.set(id, new Map());
    },
    async closeProgram(id) {
      l.sent.push(`close:${id}`);
      l.programs.get(id)!.open = false;
      l.seeds.set(id, 'seed');
    },
    async select(id, r) {
      l.sent.push(`select:${r}`);
      l.receiptsByProgram.get(id)!.set(r, 'selected');
    },
  };
}

function fakeHolder(l: FakeLedger, name: string, credential: Credential): HolderPort {
  return {
    credential,
    receiptFor: (id) => `${name}@${id}`,
    async apply(id) {
      l.sent.push(`apply:${name}`);
      l.receiptsByProgram.get(id)!.set(`${name}@${id}`, 'submitted');
      return `${name}@${id}`;
    },
    async claim(id) {
      l.sent.push(`claim:${name}`);
      l.receiptsByProgram.get(id)!.set(`${name}@${id}`, 'claimed');
      return `${name}@${id}`;
    },
  };
}

describe('UC-2 register from a real notice clause', () => {
  it('derives the policy from the clause and registers it', async () => {
    const l = new FakeLedger();
    const clause = NOTICE_CLAUSES[0]!;
    const { programId, policy: p } = await registerProgramFromClause(fakeOperator(l), clause, 10);
    expect(p).toEqual(policyFromClause(clause));
    expect(l.sent).toEqual([`register:${programId}`]);
    expect(programId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a non-positive capacity before any transaction', async () => {
    const l = new FakeLedger();
    await expect(registerProgramFromClause(fakeOperator(l), NOTICE_CLAUSES[0]!, 0)).rejects.toThrow(/capacity/);
    expect(l.sent).toEqual([]);
  });
});

describe('UC-3 apply', () => {
  it('an ineligible holder gets the failing predicates and sends nothing', async () => {
    const l = new FakeLedger();
    await fakeOperator(l).registerProgram('p', policy, 1);
    const r = await applyToProgram(fakeHolder(l, 'b', { ...eligible, employed: true }), l, 'p');
    expect(r.kind).toBe('ineligible');
    if (r.kind === 'ineligible') expect(r.failed).toEqual(['unemployed']);
    expect(l.sent.filter((s) => s.startsWith('apply'))).toEqual([]);
  });

  it('an eligible holder applies once; the second attempt is answered locally', async () => {
    const l = new FakeLedger();
    await fakeOperator(l).registerProgram('p', policy, 1);
    const h = fakeHolder(l, 'a', eligible);
    expect(await applyToProgram(h, l, 'p')).toEqual({ kind: 'applied', receipt: 'a@p' });
    expect(await applyToProgram(h, l, 'p')).toEqual({ kind: 'already-applied', receipt: 'a@p' });
    expect(l.sent.filter((s) => s.startsWith('apply'))).toEqual(['apply:a']);
  });

  it('closed or unknown programs are reported without a transaction', async () => {
    const l = new FakeLedger();
    expect((await applyToProgram(fakeHolder(l, 'a', eligible), l, 'nope')).kind).toBe('unknown-program');
    const op = fakeOperator(l);
    await op.registerProgram('p', policy, 1);
    await op.closeProgram('p');
    expect((await applyToProgram(fakeHolder(l, 'a', eligible), l, 'p')).kind).toBe('closed');
  });
});

// fake ticket: the receipt's first letter mapped to a fixed rank (d < b < a < c)
const fakeHasher: DrawTicketHasher = { ticket: (_seed, receipt) => ({ a: '03', b: '02', c: '04', d: '01' })[receipt[0] as 'a']! };

describe('UC-4/5 draw', () => {
  it('closes the program (revealing the seed), then selects the `capacity` lowest tickets', async () => {
    const l = new FakeLedger();
    const op = fakeOperator(l);
    await op.registerProgram('p', policy, 2);
    for (const n of ['a', 'b', 'c', 'd']) await applyToProgram(fakeHolder(l, n, eligible), l, 'p');
    const picked = await drawAndSelect(op, l, fakeHasher, 'p');
    expect(picked).toEqual(['d@p', 'b@p']);
    expect(l.sent.indexOf('close:p')).toBeLessThan(l.sent.indexOf('select:d@p'));
    expect(l.receipts('p').filter((x) => x.status === 'selected')).toHaveLength(2);
    expect(auditDraw(l, fakeHasher, 'p').ok).toBe(true);
  });

  it('the public audit catches an operator who picked someone else', async () => {
    const l = new FakeLedger();
    const op = fakeOperator(l);
    await op.registerProgram('p', policy, 1);
    for (const n of ['a', 'b']) await applyToProgram(fakeHolder(l, n, eligible), l, 'p');
    await op.closeProgram('p');
    await op.select('p', 'a@p'); // b@p has the lower ticket
    const audit = auditDraw(l, fakeHasher, 'p');
    expect(audit).toMatchObject({ ok: false, unexpected: ['a@p'], missing: ['b@p'] });
  });

  it('no audit before the seed is revealed', () => {
    const l = new FakeLedger();
    expect(() => auditDraw(l, fakeHasher, 'p')).toThrow(/seed/);
  });
});

describe('UC-6 claim', () => {
  it('only a selected receipt is claimed', async () => {
    const l = new FakeLedger();
    const op = fakeOperator(l);
    await op.registerProgram('p', policy, 1);
    const a = fakeHolder(l, 'a', eligible);
    await applyToProgram(a, l, 'p');
    expect((await claimBenefit(a, l, 'p')).kind).toBe('not-selected');
    await drawAndSelect(op, l, fakeHasher, 'p');
    expect(await claimBenefit(a, l, 'p')).toEqual({ kind: 'claimed', receipt: 'a@p' });
  });
});
