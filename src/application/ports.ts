// Ports: what the application needs from the outside world. Adapters implement them
// (in-process simulator today; a Midnight network provider is the same shape, asynchronous).
import type { Credential, EligibilityPolicy } from '../domain/eligibility';

export type Hex = string;
export type ReceiptStatus = 'submitted' | 'selected' | 'claimed';

export interface ProgramView {
  id: Hex;
  policy: EligibilityPolicy;
  capacity: number;
  open: boolean;
}

/** Read-only view of the public ledger — everything here is visible to everyone. */
export interface PublicLedgerView {
  program(id: Hex): ProgramView | undefined;
  receipts(id: Hex): Array<{ receipt: Hex; status: ReceiptStatus }>;
  /** Draw seed, public once the programme has closed. */
  drawSeed(id: Hex): Hex | undefined;
}

/** ticket = hash(seed, receipt) exactly as the contract's `drawTicket` computes it. */
export interface DrawTicketHasher {
  ticket(seed: Hex, receipt: Hex): Hex;
}

/** An institution running a programme (holds the operator secret). */
export interface OperatorPort {
  registerProgram(id: Hex, policy: EligibilityPolicy, capacity: number): Promise<void>;
  closeProgram(id: Hex): Promise<void>;
  select(id: Hex, receipt: Hex): Promise<void>;
}

/** An applicant's wallet: the credential never leaves it; only proofs do. */
export interface HolderPort {
  readonly credential: Credential;
  /** The receipt this holder would file for `id` (computed locally, no transaction). */
  receiptFor(id: Hex): Hex;
  apply(id: Hex): Promise<Hex>;
  claim(id: Hex): Promise<Hex>;
}

/** The contract's own `credentialCommitment(credential, holderKey(secret), salt)`, computed off-chain. */
export interface CommitmentHasher {
  commitment(credential: Credential, holderSecret: Hex, salt: Hex): Hex;
}

/** 32 random bytes as hex (a CSPRNG in production, deterministic in tests). */
export interface RandomSource {
  bytes32(): Hex;
}
