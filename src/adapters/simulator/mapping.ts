// Boundary mapping between the framework-free domain (numbers, hex strings)
// and the generated contract types (bigint, Uint8Array).
import type {
  Credential as ContractCredential,
  EligibilityPolicy as ContractPolicy,
} from '../../../contract/src/managed/justenough/contract/index.js';
import type { Credential, EligibilityPolicy } from '../../domain/eligibility';
import { programIdOf } from '../../domain/program-id';

export function toContractCredential(c: Credential): ContractCredential {
  return {
    birthDate: BigInt(c.birthDate),
    sido: BigInt(c.sido),
    sigungu: BigInt(c.sigungu),
    student: c.student,
    employed: c.employed,
    incomePct: BigInt(c.incomePct),
    validUntil: BigInt(c.validUntil),
  };
}

export function fromContractCredential(c: ContractCredential): Credential {
  return {
    birthDate: Number(c.birthDate),
    sido: Number(c.sido),
    sigungu: Number(c.sigungu),
    student: c.student,
    employed: c.employed,
    incomePct: Number(c.incomePct),
    validUntil: Number(c.validUntil),
  };
}

export function toContractPolicy(p: EligibilityPolicy): ContractPolicy {
  return {
    minBirthDate: BigInt(p.minBirthDate),
    maxBirthDate: BigInt(p.maxBirthDate),
    sido: BigInt(p.sido),
    sigungu: BigInt(p.sigungu),
    requireStudent: p.requireStudent,
    requireUnemployed: p.requireUnemployed,
    maxIncomePct: BigInt(p.maxIncomePct),
    referenceDate: BigInt(p.referenceDate),
  };
}

export function fromContractPolicy(p: ContractPolicy): EligibilityPolicy {
  return {
    minBirthDate: Number(p.minBirthDate),
    maxBirthDate: Number(p.maxBirthDate),
    sido: Number(p.sido),
    sigungu: Number(p.sigungu),
    requireStudent: p.requireStudent,
    requireUnemployed: p.requireUnemployed,
    maxIncomePct: Number(p.maxIncomePct),
    referenceDate: Number(p.referenceDate),
  };
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^([0-9a-f]{2})*$/i.test(hex)) throw new Error(`Not hex: ${hex}`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function programIdFrom(slug: string): Uint8Array {
  return hexToBytes(programIdOf(slug));
}
