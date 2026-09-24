// AC-23 — registrar batch issuance on the contract's own hash: shuffled public commitments, private
// bundles that really apply on the compiled contract, and 1,000 rows well under 5 s.
import { describe, expect, it } from 'vitest';
import { issueBatch } from '../../src/application/issue-batch';
import { applyToProgram, registerProgramFromClause } from '../../src/application/use-cases';
import { parseRegistrarCsv, REGISTRAR_HEADER } from '../../src/domain/registrar';
import { contractCommitmentHasher, cryptoRandom } from '../../src/adapters/simulator/commitment';
import { SimulatedNetwork } from '../../src/adapters/simulator/simulated-network';
import { SimulatedHolder, SimulatedLedgerView, SimulatedOperator } from '../../src/adapters/simulator/ports';
import { hexToBytes, toContractCredential } from '../../src/adapters/simulator/mapping';
import { DEMO_PROGRAM, policyFromClause } from '../../src/domain/notices';
import { explainEligibility } from '../../src/domain/eligibility';
import type { RandomSource } from '../../src/application/ports';

function csv(n: number): string {
  const rows = Array.from({ length: n }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, '0');
    return `R-${String(i).padStart(5, '0')},199${i % 10}-0${(i % 9) + 1}-${day},11,${[11620, 11650, 11680][i % 3]},${i % 2 ? 'Y' : 'N'},${i % 5 ? 'N' : 'Y'},${60 + (i % 120)},2027-12-31`;
  });
  return [REGISTRAR_HEADER.join(','), ...rows].join('\n');
}

/** Deterministic randomness for order checks. */
function counterRandom(): RandomSource {
  let n = 0;
  return { bytes32: () => (++n).toString(16).padStart(8, '0').repeat(8) };
}

describe('issueBatch', () => {
  it('one commitment per row, shuffled; one private bundle per holder; the public file names nobody', () => {
    const { records } = parseRegistrarCsv(csv(40));
    const out = issueBatch(records, contractCommitmentHasher, counterRandom());
    expect(out.publicCommitments).toHaveLength(40);
    expect(new Set(out.publicCommitments).size).toBe(40);
    expect(out.bundles.map((b) => b.holderRef)).toEqual(records.map((r) => r.holderRef));
    expect(out.publicCommitments).not.toEqual(out.bundles.map((b) => b.commitment)); // order does not follow the export
    expect(new Set(out.publicCommitments)).toEqual(new Set(out.bundles.map((b) => b.commitment)));
    const publicFile = JSON.stringify(out.publicCommitments);
    for (const r of records) expect(publicFile).not.toContain(r.holderRef);
    for (const c of out.publicCommitments) expect(c).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a bundle applies on the compiled contract once the batch is issued', async () => {
    const { records } = parseRegistrarCsv(csv(12));
    const out = issueBatch(records, contractCommitmentHasher, cryptoRandom);
    const issuerSecret = new Uint8Array(32).fill(7);
    const net = SimulatedNetwork.deploy(issuerSecret);
    const issuer = net.party({ secret: issuerSecret });
    for (const c of out.publicCommitments) issuer.issueCredential(hexToBytes(c));
    const operator = new SimulatedOperator(net.party({ secret: new Uint8Array(32).fill(8) }));
    const view = new SimulatedLedgerView(net);
    const { programId } = await registerProgramFromClause(operator, DEMO_PROGRAM, 5);
    const policy = policyFromClause(DEMO_PROGRAM);
    const b = out.bundles.find((x) => explainEligibility(x.credential, policy).eligible)!;
    const holder = new SimulatedHolder(
      net.party({ secret: hexToBytes(b.secret), credential: toContractCredential(b.credential), salt: hexToBytes(b.salt) }),
    );
    expect((await applyToProgram(holder, view, programId)).kind).toBe('applied');
  });

  it('1,000 rows in under 5 seconds', () => {
    const { records, errors } = parseRegistrarCsv(csv(1000));
    expect(errors).toEqual([]);
    const t = performance.now();
    const out = issueBatch(records, contractCommitmentHasher, cryptoRandom);
    expect(out.publicCommitments).toHaveLength(1000);
    expect(performance.now() - t).toBeLessThan(5000);
  });
});
