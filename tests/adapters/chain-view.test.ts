// AC-19 — "What the chain sees": after every call, a live scan of the public state and the call's
// transcript finds none of the applicant's private values; the positive control proves the scan can see.
// AC-20 — the Web3 community grant preset runs the three beats on the compiled contract.
import { describe, expect, it } from 'vitest';
import { SimulatedNetwork } from '../../src/adapters/simulator/simulated-network';
import { SimulatedHolder, SimulatedLedgerView, SimulatedOperator } from '../../src/adapters/simulator/ports';
import { toContractCredential } from '../../src/adapters/simulator/mapping';
import { chainView, privateNeedles } from '../../src/adapters/simulator/chain-view';
import { applyToProgram, registerProgramFromClause } from '../../src/application/use-cases';
import { DEMO_PRESETS, forgeToPass, type PresetId } from '../../src/domain/presets';
import { policyFromClause } from '../../src/domain/notices';

const bytes = (n: number) => new Uint8Array(32).fill(n);

function world(id: PresetId) {
  const preset = DEMO_PRESETS[id];
  const net = SimulatedNetwork.deploy(bytes(1));
  const issuer = net.party({ secret: bytes(1) });
  const operator = new SimulatedOperator(net.party({ secret: bytes(2) }));
  const view = new SimulatedLedgerView(net);
  const holder = (n: number, c = preset.applicantA) => {
    const p = net.party({ secret: bytes(n), credential: toContractCredential(c), salt: bytes(n + 100) });
    issuer.issueCredential(p.commitment());
    return new SimulatedHolder(p);
  };
  return { preset, net, operator, view, holder };
}

describe('chainView', () => {
  it('privateNeedles leaves out what the policy itself publishes', () => {
    const { preset } = world('youth');
    const policy = policyFromClause(preset.clause);
    const a = preset.applicantA;
    expect(privateNeedles(a, policy)).toEqual([a.birthDate, a.sigungu, a.incomePct, a.validUntil]);
    expect(privateNeedles(a, { ...policy, sigungu: a.sigungu, maxIncomePct: a.incomePct })).toEqual([a.birthDate, a.validUntil]);
  });

  it('after issue, register and apply: the call is named, and 0 private values are found', async () => {
    const { preset, net, operator, view, holder } = world('youth');
    const a = holder(10);
    const { programId, policy } = await registerProgramFromClause(operator, preset.clause, 5);
    const needles = privateNeedles(preset.applicantA, policy);

    const afterRegister = chainView(net, needles);
    expect(afterRegister.circuit).toBe('registerProgram');
    expect(afterRegister.privateValuesFound).toEqual([]);

    expect((await applyToProgram(a, view, programId)).kind).toBe('applied');
    const afterApply = chainView(net, needles);
    expect(afterApply.circuit).toBe('apply');
    expect(afterApply.publicOps).toBeGreaterThan(0);
    expect(afterApply.atomsScanned).toBeGreaterThan(50);
    expect(afterApply.privateValuesFound).toEqual([]);
    expect(afterApply.applicants).toBe(1);
  });

  it('positive control: the policy income cap is public, and the scan finds it', async () => {
    const { preset, net, operator } = world('youth');
    const { policy } = await registerProgramFromClause(operator, preset.clause, 5);
    expect(chainView(net, [policy.maxIncomePct]).privateValuesFound).toEqual([BigInt(policy.maxIncomePct)]);
  });
});

describe('Web3 community grant preset on the compiled contract', () => {
  it('accept → duplicate refused → ineligible refused → forged refused as not issued', async () => {
    const { preset, net, operator, view, holder } = world('grant');
    const { programId } = await registerProgramFromClause(operator, preset.clause, 5);
    const a = holder(10);
    const b = holder(11, preset.applicantB);

    expect((await applyToProgram(a, view, programId)).kind).toBe('applied');
    await expect(a.apply(programId)).rejects.toThrow(/Already applied to this program/);
    await expect(b.apply(programId)).rejects.toThrow(/Credential does not meet the eligibility policy/);

    const forged = new SimulatedHolder(
      net.party({ ...b.party.state, credential: toContractCredential(forgeToPass(preset.applicantB, policyFromClause(preset.clause))) }),
    );
    await expect(forged.apply(programId)).rejects.toThrow(/Credential was not issued by the issuer/);
    expect(view.receipts(programId)).toHaveLength(1);
    expect(chainView(net, privateNeedles(preset.applicantA, policyFromClause(preset.clause))).privateValuesFound).toEqual([]);
  });
});
