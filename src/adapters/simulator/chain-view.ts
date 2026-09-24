// "What the chain sees" (AC-19): after a call, everything an observer of the chain can read, plus a live
// scan of the public state and that call's public transcript for the applicant's private values.
import type { Credential, EligibilityPolicy } from '../../domain/eligibility';
import { atomsFromStateDump, atomsFromTranscriptJson, attributeValuesIn } from '../leak-scan';
import type { SimulatedNetwork } from './simulated-network';

export interface ChainView {
  /** The last circuit called, if any. */
  circuit?: string;
  /** Operations of that call that went on-chain (public transcript length). */
  publicOps: number;
  /** Public byte atoms decoded and compared (ledger state + that call's transcript). */
  atomsScanned: number;
  /** Private values found among them — the demo's promise is that this stays empty. */
  privateValuesFound: bigint[];
  issuedCount: number;
  /** Receipts across all programmes. */
  applicants: number;
}

/**
 * The applicant's attribute values that the policy does not already make public. Booleans and the
 * province are left out: 0, 1 and 11 appear in any ledger as counters and flags. Same needles as the
 * devnet run (birth date, district, income, valid-until).
 */
export function privateNeedles(c: Credential, p: EligibilityPolicy): number[] {
  const out = [c.birthDate];
  if (p.sigungu !== c.sigungu) out.push(c.sigungu);
  if (p.maxIncomePct !== c.incomePct) out.push(c.incomePct);
  if (p.referenceDate !== c.validUntil) out.push(c.validUntil);
  return out;
}

export function chainView(net: SimulatedNetwork, needles: readonly (number | bigint)[]): ChainView {
  const tx = net.txLog[net.txLog.length - 1];
  const state = JSON.parse(net.publicStateDump()) as { raw: string };
  const atoms = [...atomsFromStateDump(state.raw), ...(tx ? atomsFromTranscriptJson(tx.publicTranscriptDump) : [])];
  const l = net.ledger();
  let applicants = 0;
  for (const [id] of l.programs) applicants += Number(l.applicantCount.lookup(id).read());
  return {
    circuit: tx?.circuit,
    publicOps: tx?.publicOps ?? 0,
    atomsScanned: atoms.length,
    privateValuesFound: attributeValuesIn(atoms, needles),
    issuedCount: Number(l.issuedCount),
    applicants,
  };
}
