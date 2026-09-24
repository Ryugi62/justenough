// Demo presets: a programme plus two synthetic applicants — A meets the rule, B fails exactly one predicate.
// Every persona is synthetic (rules art. 10 ① 4). `youth` is the default (Korean youth allowance);
// `grant` is the Web3 community grant scenario added for the 3rd-Web-Hack entry.
import { ymd } from './dates';
import { explainEligibility, type Credential, type EligibilityPolicy, type Predicate } from './eligibility';
import { DEMO_PROGRAM, GRANT_PROGRAM, type NoticeClause } from './notices';
import { SIDO } from './regions';

export type PresetId = 'youth' | 'grant';

export interface DemoPreset {
  id: PresetId;
  clause: NoticeClause;
  applicantA: Credential;
  applicantB: Credential;
  capacity: number;
}

const A: Credential = {
  birthDate: ymd(1999, 4, 17),
  sido: SIDO.SEOUL,
  sigungu: 11620,
  student: false,
  employed: false,
  incomePct: 120,
  validUntil: ymd(2027, 3, 31),
};
const B: Credential = { ...A, birthDate: ymd(1998, 11, 3), sigungu: 11680, employed: true, incomePct: 90 };

export const DEMO_PRESETS: Readonly<Record<PresetId, DemoPreset>> = {
  youth: { id: 'youth', clause: DEMO_PROGRAM, applicantA: A, applicantB: B, capacity: 5 },
  grant: { id: 'grant', clause: GRANT_PROGRAM, applicantA: { ...A, student: true }, applicantB: B, capacity: 5 },
};

export function presetFrom(search: string): PresetId {
  const m = /[?&]preset=([^&#]+)/.exec(search);
  return m?.[1] === 'grant' ? 'grant' : 'youth';
}

/** The predicates a credential fails under a policy. */
export function failingPredicates(c: Credential, p: EligibilityPolicy): Predicate[] {
  return explainEligibility(c, p).checks.filter((x) => !x.ok).map((x) => x.predicate);
}

/**
 * The cheat the demo tries: rewrite the failing values so they satisfy the rule. The values then pass,
 * but the credential no longer hashes to anything the issuer published — the circuit must refuse it.
 */
export function forgeToPass(c: Credential, p: EligibilityPolicy): Credential {
  const f: Credential = { ...c };
  for (const pred of failingPredicates(c, p)) {
    switch (pred) {
      case 'age':
        f.birthDate = c.birthDate < p.minBirthDate ? p.minBirthDate : p.maxBirthDate;
        break;
      case 'province':
        f.sido = p.sido;
        break;
      case 'district':
        f.sigungu = p.sigungu;
        break;
      case 'student':
        f.student = true;
        break;
      case 'unemployed':
        f.employed = false;
        break;
      case 'income':
        f.incomePct = p.maxIncomePct;
        break;
      case 'validity':
        f.validUntil = p.referenceDate;
        break;
    }
  }
  return f;
}
