// UC-7 — issue a registrar batch: one private bundle per holder, and the public commitments in a
// shuffled order so the published list does not follow the export's order (timing/ordering linkage).
// The registrar commits to each holder's own public key; it never makes or sees a holder secret, so neither it
// nor an operator in the same institution can recompute a holder's receipt.
import type { Credential } from '../domain/eligibility';
import type { RegistrarRecord } from '../domain/registrar';
import type { CommitmentHasher, Hex, RandomSource } from './ports';

export interface HolderBundle {
  holderRef: string;
  /** The holder's public key the commitment is bound to (from the CSV). The secret behind it stays on the holder's device. */
  holderKey: Hex;
  /** 32-byte salt of the commitment. Private. */
  salt: Hex;
  credential: Credential;
  commitment: Hex;
}

export interface IssueBatchResult {
  /** The only output to publish (issueCredential, one per entry). */
  publicCommitments: Hex[];
  /** One per holder, delivered privately (e.g. through the registrar's student portal). */
  bundles: HolderBundle[];
}

export function issueBatch(records: readonly RegistrarRecord[], hasher: CommitmentHasher, random: RandomSource): IssueBatchResult {
  const bundles = records.map((r) => {
    const salt = random.bytes32();
    return { holderRef: r.holderRef, holderKey: r.holderKey, salt, credential: r.credential, commitment: hasher.commitment(r.credential, r.holderKey, salt) };
  });
  // Fisher–Yates with 32 bits of randomness per step (bias < 2^-20 for batches under 4,096).
  const order = bundles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = parseInt(random.bytes32().slice(0, 8), 16) % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { publicCommitments: order.map((i) => bundles[i]!.commitment), bundles };
}
