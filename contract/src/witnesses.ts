// SPDX-License-Identifier: Apache-2.0
// Private-state witnesses for justenough.compact. Everything returned here stays on the
// holder's device: it feeds the proof but is never written to the public ledger.
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Credential, Ledger, Witnesses } from './managed/justenough/contract/index.js';

export interface JustEnoughPrivateState {
  /** 32-byte secret; issuer/operator/holder keys are domain-separated hashes of it. */
  readonly secret: Uint8Array;
  /** Present only in an applicant's wallet. */
  readonly credential?: Credential;
  /** Blinding salt chosen at issuance; without it the commitment cannot be recomputed. */
  readonly salt?: Uint8Array;
}

const DEPTH = 16;

type Ctx = WitnessContext<Ledger, JustEnoughPrivateState>;

export const witnesses: Witnesses<JustEnoughPrivateState> = {
  localSecret: ({ privateState }: Ctx) => {
    if (privateState.secret.length !== 32) throw new Error('localSecret: expected 32 bytes');
    return [privateState, privateState.secret];
  },

  heldCredential: ({ privateState }: Ctx) => {
    if (!privateState.credential) throw new Error('This wallet holds no credential');
    return [privateState, privateState.credential];
  },

  credentialSalt: ({ privateState }: Ctx) => {
    if (!privateState.salt || privateState.salt.length !== 32) throw new Error('This wallet holds no credential salt');
    return [privateState, privateState.salt];
  },

  // Find the credential in the public tree. If it is not there, hand the circuit a well-formed
  // path anyway: the circuit — not this helper — is what refuses an unissued credential.
  credentialPath: ({ privateState, ledger }: Ctx, commitment: Uint8Array) => {
    const found = ledger.credentials.findPathForLeaf(commitment);
    if (found) return [privateState, found];
    const path = Array.from({ length: DEPTH }, () => ({ sibling: { field: 0n }, goes_left: true }));
    return [privateState, { leaf: commitment, path }];
  },
};
