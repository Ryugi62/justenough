// Circuit behaviour through the compiled contract (contract/src/managed) and the in-process simulator.
// AC-1 … AC-10. Every persona here is synthetic.
import { beforeEach, describe, expect, it } from 'vitest';
import { ApplicationStatus, ProgramStatus, pureCircuits } from '../../contract/src/managed/justenough/contract/index.js';
import { SimulatedNetwork, type Party } from '../../src/adapters/simulator/simulated-network';
import { toContractCredential, toContractPolicy, programIdFrom } from '../../src/adapters/simulator/mapping';
import { birthRangeFor, ymd } from '../../src/domain/dates';
import { atomsFromStateDump, atomsFromTranscriptJson, attributeValuesIn } from '../../src/adapters/leak-scan';
import { SIDO } from '../../src/domain/regions';
import type { Credential, EligibilityPolicy } from '../../src/domain/eligibility';

const REF = ymd(2026, 9, 24);
const bytes = (n: number) => new Uint8Array(32).fill(n);

const credA: Credential = {
  birthDate: ymd(1999, 4, 17),
  sido: SIDO.SEOUL,
  sigungu: 11620,
  student: false,
  employed: false,
  incomePct: 123,
  validUntil: ymd(2027, 3, 31),
};

const policy: EligibilityPolicy = {
  ...birthRangeFor(REF, { minAge: 19, maxAge: 34 }),
  sido: SIDO.SEOUL,
  sigungu: 0,
  requireStudent: false,
  requireUnemployed: true,
  maxIncomePct: 150,
  referenceDate: REF,
};

const PROGRAM = programIdFrom('demo-youth-allowance-2026');
const OTHER_PROGRAM = programIdFrom('demo-other-2026');

let net: SimulatedNetwork;
let issuer: Party;
let operator: Party;

function holder(secretByte: number, cred: Credential, saltByte = secretByte + 100): Party {
  return net.party({ secret: bytes(secretByte), credential: toContractCredential(cred), salt: bytes(saltByte) });
}

function issueTo(p: Party): Uint8Array {
  const c = p.commitment();
  issuer.issueCredential(c);
  return c;
}

beforeEach(() => {
  net = SimulatedNetwork.deploy(bytes(1));
  issuer = net.party({ secret: bytes(1) });
  operator = net.party({ secret: bytes(2) });
  operator.registerProgram(PROGRAM, toContractPolicy(policy), 2n);
});

describe('deployment and issuance', () => {
  it('pins the deployer as issuer', () => {
    expect(net.ledger().issuer).toEqual(pureCircuits.issuerKey(bytes(1)));
  });

  it('AC-1 only the issuer can insert commitments', () => {
    const a = holder(10, credA);
    expect(() => operator.issueCredential(a.commitment())).toThrow(/Only the issuer can issue credentials/);
    issueTo(a);
    expect(net.ledger().issuedCount).toBe(1n);
    expect(net.ledger().credentials.findPathForLeaf(a.commitment())).toBeDefined();
  });
});

describe('apply', () => {
  it('AC-2 an eligible, issued holder files one receipt', () => {
    const a = holder(10, credA);
    issueTo(a);
    const receipt = a.apply(PROGRAM).result;
    expect(receipt).toEqual(pureCircuits.nullifierFor(bytes(10), PROGRAM));
    const l = net.ledger();
    expect(l.applications.lookup(PROGRAM).member(receipt)).toBe(true);
    expect(l.applications.lookup(PROGRAM).lookup(receipt)).toBe(ApplicationStatus.submitted);
    expect(l.applicantCount.lookup(PROGRAM).read()).toBe(1n);
  });

  it('AC-3 no attribute value reaches the public state or the public transcript', () => {
    const a = holder(10, credA);
    issueTo(a);
    const tx = a.apply(PROGRAM);
    const needles = [credA.birthDate, credA.sigungu, credA.incomePct, credA.validUntil].map(BigInt);

    // Every value on the ledger is a list of little-endian byte atoms: decode and compare numbers.
    const transcriptAtoms = atomsFromTranscriptJson(tx.publicTranscriptDump);
    const state = JSON.parse(net.publicStateDump()) as { raw: string };
    const stateAtoms = atomsFromStateDump(state.raw);
    expect(transcriptAtoms.length).toBeGreaterThan(20);
    expect(stateAtoms.length).toBeGreaterThan(10);
    expect(attributeValuesIn([...transcriptAtoms, ...stateAtoms], needles)).toEqual([]);
    // the structured public view (decimal) carries none of them either
    const { raw: _raw, ...view } = state as Record<string, unknown>;
    for (const n of needles) expect(JSON.stringify(view)).not.toContain(`"${n}"`);

    // sanity: the same decoding DOES find public policy values (so the check can fail)
    expect(attributeValuesIn(transcriptAtoms, [policy.referenceDate])).toEqual([BigInt(policy.referenceDate)]);
    // …and the private inputs (never sent) do carry the attributes
    expect(tx.privateOutputsDump).toContain(`"birthDate":"${credA.birthDate}"`);
  });

  it('AC-4 a second application to the same program is rejected', () => {
    const a = holder(10, credA);
    issueTo(a);
    a.apply(PROGRAM);
    expect(() => a.apply(PROGRAM)).toThrow(/Already applied to this program/);
    expect(net.ledger().applicantCount.lookup(PROGRAM).read()).toBe(1n);
  });

  it('AC-5 a credential that was never issued is rejected', () => {
    const a = holder(10, credA);
    expect(() => a.apply(PROGRAM)).toThrow(/Credential was not issued by the issuer/);
  });

  it('AC-5 tampering with an issued credential (lower income) is rejected', () => {
    const honest = holder(10, { ...credA, incomePct: 180 });
    issueTo(honest);
    const liar = net.party({
      secret: bytes(10),
      credential: toContractCredential({ ...credA, incomePct: 90 }),
      salt: bytes(110),
    });
    expect(() => liar.apply(PROGRAM)).toThrow(/Credential was not issued by the issuer/);
  });

  it("AC-6 borrowing another holder's Merkle path is rejected", () => {
    const victim = holder(20, credA);
    const victimCommitment = issueTo(victim);
    const thief = net.party(
      { secret: bytes(30), credential: toContractCredential(credA), salt: bytes(130) },
      {
        credentialPath: ({ ledger, privateState }) => [
          privateState,
          ledger.credentials.findPathForLeaf(victimCommitment)!,
        ],
      },
    );
    expect(() => thief.apply(PROGRAM)).toThrow(/Merkle path does not belong to this credential/);
  });

  const oneFailure: Array<[string, Partial<Credential>]> = [
    ['age', { birthDate: ymd(1989, 2, 1) }],
    ['province', { sido: SIDO.BUSAN, sigungu: 26110 }],
    ['unemployed', { employed: true }],
    ['income', { incomePct: 151 }],
    ['validity', { validUntil: ymd(2026, 9, 1) }],
  ];
  for (const [name, patch] of oneFailure) {
    it(`AC-7 an issued credential failing only "${name}" cannot produce an application`, () => {
      const p = holder(40, { ...credA, ...patch });
      issueTo(p);
      expect(() => p.apply(PROGRAM)).toThrow(/Credential does not meet the eligibility policy/);
      expect(net.ledger().applicantCount.lookup(PROGRAM).read()).toBe(0n);
    });
  }

  it('AC-7 district and student predicates are enforced when the policy sets them', () => {
    const strictId = programIdFrom('demo-strict');
    operator.registerProgram(strictId, toContractPolicy({ ...policy, sigungu: 11650, requireStudent: true }), 1n);
    const a = holder(10, credA);
    issueTo(a);
    expect(() => a.apply(strictId)).toThrow(/Credential does not meet the eligibility policy/);
    const b = holder(11, { ...credA, sigungu: 11650, student: true });
    issueTo(b);
    expect(b.apply(strictId).result).toBeInstanceOf(Uint8Array);
  });

  it('AC-8 receipts are unlinkable across programs and differ from the holder key', () => {
    operator.registerProgram(OTHER_PROGRAM, toContractPolicy(policy), 5n);
    const a = holder(10, credA);
    issueTo(a);
    const r1 = a.apply(PROGRAM).result;
    const r2 = a.apply(OTHER_PROGRAM).result;
    expect(r1).not.toEqual(r2);
    expect(r1).not.toEqual(pureCircuits.holderKey(bytes(10)));
  });

  it('a stale proof still verifies after more credentials are issued (historic root)', () => {
    const a = holder(10, credA);
    issueTo(a);
    for (let i = 0; i < 5; i++) issueTo(holder(60 + i, credA));
    expect(a.apply(PROGRAM).result).toBeInstanceOf(Uint8Array);
  });

  it('closed programs refuse applications', () => {
    const a = holder(10, credA);
    issueTo(a);
    operator.closeProgram(PROGRAM);
    expect(net.ledger().programs.lookup(PROGRAM).status).toBe(ProgramStatus.closed);
    expect(() => a.apply(PROGRAM)).toThrow(/Program is closed/);
  });
});

describe('program registration', () => {
  it('rejects duplicates, empty age bands and zero capacity', () => {
    expect(() => operator.registerProgram(PROGRAM, toContractPolicy(policy), 1n)).toThrow(/Program already exists/);
    const inverted = { ...policy, minBirthDate: policy.maxBirthDate + 1 };
    expect(() => operator.registerProgram(programIdFrom('x'), toContractPolicy(inverted), 1n)).toThrow(/Empty age band/);
    expect(() => operator.registerProgram(programIdFrom('y'), toContractPolicy(policy), 0n)).toThrow(/Capacity must be positive/);
  });

  it('stores the policy publicly, exactly as registered', () => {
    const p = net.ledger().programs.lookup(PROGRAM);
    expect(p.policy).toEqual(toContractPolicy(policy));
    expect(p.operator).toEqual(pureCircuits.operatorKey(bytes(2)));
    expect(p.capacity).toBe(2n);
  });
});

describe('draw and claim', () => {
  let a: Party;
  let b: Party;
  let c: Party;
  let ra: Uint8Array;
  let rb: Uint8Array;
  let rc: Uint8Array;

  beforeEach(() => {
    a = holder(10, credA);
    b = holder(11, { ...credA, birthDate: ymd(1995, 12, 1) });
    c = holder(12, { ...credA, incomePct: 40 });
    for (const p of [a, b, c]) issueTo(p);
    ra = a.apply(PROGRAM).result;
    rb = b.apply(PROGRAM).result;
    rc = c.apply(PROGRAM).result;
  });

  it('AC-9 selection requires the program to be closed', () => {
    expect(() => operator.selectApplicant(PROGRAM, ra)).toThrow(/Close the program before selecting/);
  });

  it('AC-9 only the operator can close or select', () => {
    expect(() => a.closeProgram(PROGRAM)).toThrow(/Only the program operator can do this/);
    operator.closeProgram(PROGRAM);
    expect(() => issuer.selectApplicant(PROGRAM, ra)).toThrow(/Only the program operator can do this/);
  });

  it('AC-9 selection stops at capacity and never selects twice', () => {
    operator.closeProgram(PROGRAM);
    operator.selectApplicant(PROGRAM, ra);
    expect(() => operator.selectApplicant(PROGRAM, ra)).toThrow(/Receipt was already selected/);
    operator.selectApplicant(PROGRAM, rc);
    expect(() => operator.selectApplicant(PROGRAM, rb)).toThrow(/All slots are already filled/);
    expect(net.ledger().selectedCount.lookup(PROGRAM).read()).toBe(2n);
    expect(() => operator.selectApplicant(PROGRAM, bytes(99))).toThrow(/Unknown receipt/);
  });

  it('AC-10 the selected holder claims once; others cannot', () => {
    operator.closeProgram(PROGRAM);
    operator.selectApplicant(PROGRAM, ra);
    expect(a.claimBenefit(PROGRAM).result).toEqual(ra);
    expect(net.ledger().applications.lookup(PROGRAM).lookup(ra)).toBe(ApplicationStatus.claimed);
    expect(() => a.claimBenefit(PROGRAM)).toThrow(/This application was not selected/);
    expect(() => b.claimBenefit(PROGRAM)).toThrow(/This application was not selected/);
    const stranger = holder(77, credA);
    expect(() => stranger.claimBenefit(PROGRAM)).toThrow(/No application from this holder/);
  });

  it('the operator view holds receipts and counts only', () => {
    const view = [...net.ledger().applications.lookup(PROGRAM)];
    expect(view.map(([r]) => r.length)).toEqual([32, 32, 32]);
    expect(new Set(view.map(([, s]) => s))).toEqual(new Set([ApplicationStatus.submitted]));
    expect(rb).toBeInstanceOf(Uint8Array);
  });
});

describe('auditable draw (seed committed at registration, revealed at close)', () => {
  it('registration stores only a commitment; closing reveals the seed that matches it', () => {
    const p = net.ledger().programs.lookup(PROGRAM);
    expect(p.seedCommitment).toEqual(pureCircuits.seedCommitmentOf(pureCircuits.drawSeedFor(bytes(2), PROGRAM)));
    expect(net.ledger().drawSeeds.member(PROGRAM)).toBe(false);
    operator.closeProgram(PROGRAM);
    const seed = net.ledger().drawSeeds.lookup(PROGRAM);
    expect(pureCircuits.seedCommitmentOf(seed)).toEqual(p.seedCommitment);
  });

  it('the seed is fixed before any receipt exists, so tickets cannot be steered after the fact', () => {
    const seedBefore = pureCircuits.drawSeedFor(bytes(2), PROGRAM);
    const a = holder(10, credA);
    issueTo(a);
    const receipt = a.apply(PROGRAM).result;
    operator.closeProgram(PROGRAM);
    const seed = net.ledger().drawSeeds.lookup(PROGRAM);
    expect(seed).toEqual(seedBefore);
    expect(pureCircuits.drawTicket(seed, receipt)).toEqual(pureCircuits.drawTicket(seedBefore, receipt));
  });

  it('tickets differ per receipt and per seed', () => {
    const s1 = pureCircuits.drawSeedFor(bytes(2), PROGRAM);
    const s2 = pureCircuits.drawSeedFor(bytes(2), OTHER_PROGRAM);
    expect(pureCircuits.drawTicket(s1, bytes(7))).not.toEqual(pureCircuits.drawTicket(s1, bytes(8)));
    expect(pureCircuits.drawTicket(s1, bytes(7))).not.toEqual(pureCircuits.drawTicket(s2, bytes(7)));
  });
});
