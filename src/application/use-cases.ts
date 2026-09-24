// Use cases UC-2 … UC-6. The application decides *whether* a transaction is worth sending
// (eligibility pre-check, duplicate check); the contract decides whether it is valid.
import { auditSelection, selectByTickets, type AuditResult } from '../domain/draw';
import { explainEligibility, type EligibilityPolicy, type EligibilityReport, type Predicate } from '../domain/eligibility';
import { policyFromClause, type NoticeClause } from '../domain/notices';
import { programIdOf } from '../domain/program-id';
import type { DrawTicketHasher, Hex, HolderPort, OperatorPort, PublicLedgerView } from './ports';

export async function registerProgramFromClause(
  operator: OperatorPort,
  clause: NoticeClause,
  capacity: number,
): Promise<{ programId: Hex; policy: EligibilityPolicy }> {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
  const policy = policyFromClause(clause);
  const programId = programIdOf(clause.id);
  await operator.registerProgram(programId, policy, capacity);
  return { programId, policy };
}

export type ApplyOutcome =
  | { kind: 'applied'; receipt: Hex }
  | { kind: 'already-applied'; receipt: Hex }
  | { kind: 'ineligible'; failed: Predicate[]; report: EligibilityReport }
  | { kind: 'closed' }
  | { kind: 'unknown-program' };

export async function applyToProgram(holder: HolderPort, ledger: PublicLedgerView, programId: Hex): Promise<ApplyOutcome> {
  const program = ledger.program(programId);
  if (!program) return { kind: 'unknown-program' };
  if (!program.open) return { kind: 'closed' };
  const mine = holder.receiptFor(programId);
  if (ledger.receipts(programId).some((r) => r.receipt === mine)) return { kind: 'already-applied', receipt: mine };
  const report = explainEligibility(holder.credential, program.policy);
  if (!report.eligible) {
    return { kind: 'ineligible', failed: report.checks.filter((c) => !c.ok).map((c) => c.predicate), report };
  }
  const receipt = await holder.apply(programId);
  return { kind: 'applied', receipt };
}

function ticketsOf(ledger: PublicLedgerView, hasher: DrawTicketHasher, programId: Hex) {
  const seed = ledger.drawSeed(programId);
  if (!seed) throw new Error('The draw seed is revealed only when the programme closes');
  return ledger.receipts(programId).map((r) => ({ ...r, ticket: hasher.ticket(seed, r.receipt) }));
}

/** Close the programme (revealing the committed seed), then select the lowest tickets. */
export async function drawAndSelect(
  operator: OperatorPort,
  ledger: PublicLedgerView,
  hasher: DrawTicketHasher,
  programId: Hex,
): Promise<Hex[]> {
  const program = ledger.program(programId);
  if (!program) throw new Error('Unknown program');
  if (program.open) await operator.closeProgram(programId);
  const entries = ticketsOf(ledger, hasher, programId);
  const taken = entries.filter((r) => r.status !== 'submitted').length;
  const pool = entries.filter((r) => r.status === 'submitted');
  const picked = selectByTickets(pool, Math.max(0, program.capacity - taken));
  for (const r of picked) await operator.select(programId, r);
  return picked;
}

/** Anyone can run this against the public ledger: were the lowest tickets the ones selected? */
export function auditDraw(ledger: PublicLedgerView, hasher: DrawTicketHasher, programId: Hex): AuditResult {
  const program = ledger.program(programId);
  const entries = ticketsOf(ledger, hasher, programId);
  const selected = entries.filter((r) => r.status !== 'submitted').map((r) => r.receipt);
  return auditSelection(entries, selected, program?.capacity ?? 0);
}

export type ClaimOutcome =
  | { kind: 'claimed'; receipt: Hex }
  | { kind: 'not-selected' }
  | { kind: 'already-claimed' }
  | { kind: 'no-application' };

export async function claimBenefit(holder: HolderPort, ledger: PublicLedgerView, programId: Hex): Promise<ClaimOutcome> {
  const mine = holder.receiptFor(programId);
  const entry = ledger.receipts(programId).find((r) => r.receipt === mine);
  if (!entry) return { kind: 'no-application' };
  if (entry.status === 'submitted') return { kind: 'not-selected' };
  if (entry.status === 'claimed') return { kind: 'already-claimed' };
  const receipt = await holder.claim(programId);
  return { kind: 'claimed', receipt };
}
