// UC-7 — a registrar's (학사 시스템) CSV export → credentials. The first pilot's issuer path:
// the registrar already holds these records; it exports one row per person and publishes only hashes.
import { isValidYMD, parseYMD } from './dates';
import type { Credential } from './eligibility';
import { isKnownSido, sidoOfDistrict } from './regions';

export const REGISTRAR_HEADER = ['holder_ref', 'birth_date', 'sido', 'sigungu', 'student', 'employed', 'income_pct', 'valid_until'] as const;

export interface RegistrarRecord {
  line: number;
  /** The registrar's own reference (e.g. a student number): routes the private bundle, never published. */
  holderRef: string;
  credential: Credential;
}

export interface RowError {
  line: number;
  reason: string;
}

const YES = new Set(['y', 'yes', 'true', '1']);
const NO = new Set(['n', 'no', 'false', '0']);

function yesNo(v: string, column: string): boolean {
  const k = v.trim().toLowerCase();
  if (YES.has(k)) return true;
  if (NO.has(k)) return false;
  throw new Error(`${column} must be Y or N, got "${v}"`);
}

function date(v: string, column: string): number {
  try {
    const d = parseYMD(v.trim());
    if (!isValidYMD(d)) throw new Error('invalid');
    return d;
  } catch {
    throw new Error(`${column} must be a real YYYY-MM-DD date, got "${v}"`);
  }
}

function integer(v: string, column: string, min: number, max: number): number {
  const n = Number(v.trim());
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${column} must be an integer in ${min}..${max}, got "${v}"`);
  return n;
}

export function parseRegistrarCsv(csv: string): { records: RegistrarRecord[]; errors: RowError[] } {
  const lines = csv.replace(/\r\n?/g, '\n').split('\n');
  const header = (lines[0] ?? '').split(',').map((h) => h.trim());
  if (header.join(',') !== REGISTRAR_HEADER.join(',')) {
    throw new Error(`Registrar CSV header must be "${REGISTRAR_HEADER.join(',')}", got "${header.join(',')}"`);
  }
  const records: RegistrarRecord[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    if (raw.trim() === '') return;
    try {
      const cells = raw.split(',');
      if (cells.length !== REGISTRAR_HEADER.length) throw new Error(`expected ${REGISTRAR_HEADER.length} columns, got ${cells.length}`);
      const [ref, birth, sidoS, sigunguS, student, employed, income, valid] = cells.map((c) => c.trim()) as string[];
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(ref!)) throw new Error(`holder_ref must be 1-64 of [A-Za-z0-9_-], got "${ref}"`);
      if (seen.has(ref!)) throw new Error(`duplicate holder_ref "${ref}" (one credential per person)`);
      const sido = integer(sidoS!, 'sido', 1, 99);
      if (!isKnownSido(sido)) throw new Error(`unknown sido code ${sido}`);
      const sigungu = integer(sigunguS!, 'sigungu', 10000, 99999);
      if (sidoOfDistrict(sigungu) !== sido) throw new Error(`sigungu ${sigungu} is not in sido ${sido}`);
      const credential: Credential = {
        birthDate: date(birth!, 'birth_date'),
        sido,
        sigungu,
        student: yesNo(student!, 'student'),
        employed: yesNo(employed!, 'employed'),
        incomePct: integer(income!, 'income_pct', 0, 1000),
        validUntil: date(valid!, 'valid_until'),
      };
      seen.add(ref!);
      records.push({ line, holderRef: ref!, credential });
    } catch (e) {
      errors.push({ line, reason: (e as Error).message });
    }
  });
  return { records, errors };
}
