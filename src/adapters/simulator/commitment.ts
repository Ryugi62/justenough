// The contract's own hash for UC-7 (so off-chain issuance commits exactly as the circuit recomputes),
// and a CSPRNG random source.
import { pureCircuits } from '../../../contract/src/managed/justenough/contract/index.js';
import type { CommitmentHasher, RandomSource } from '../../application/ports';
import { bytesToHex, hexToBytes, toContractCredential } from './mapping';

export const contractCommitmentHasher: CommitmentHasher = {
  commitment: (credential, holderKey, salt) =>
    bytesToHex(pureCircuits.credentialCommitment(toContractCredential(credential), hexToBytes(holderKey), hexToBytes(salt))),
};

/** Run on the holder's device: the public key to hand the registrar. The secret never leaves the device. */
export const holderKeyOf = (holderSecret: string): string => bytesToHex(pureCircuits.holderKey(hexToBytes(holderSecret)));

export const cryptoRandom: RandomSource = {
  bytes32: () => bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32))),
};
