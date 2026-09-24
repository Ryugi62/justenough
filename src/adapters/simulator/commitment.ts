// The contract's own hash for UC-7 (so off-chain issuance commits exactly as the circuit recomputes),
// and a CSPRNG random source.
import { pureCircuits } from '../../../contract/src/managed/justenough/contract/index.js';
import type { CommitmentHasher, RandomSource } from '../../application/ports';
import { bytesToHex, hexToBytes, toContractCredential } from './mapping';

export const contractCommitmentHasher: CommitmentHasher = {
  commitment: (credential, holderSecret, salt) =>
    bytesToHex(pureCircuits.credentialCommitment(toContractCredential(credential), pureCircuits.holderKey(hexToBytes(holderSecret)), hexToBytes(salt))),
};

export const cryptoRandom: RandomSource = {
  bytes32: () => bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32))),
};
