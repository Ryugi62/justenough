// AC-23 — a registrar's CSV export becomes credentials; every bad row is rejected with its line number.
import { describe, expect, it } from 'vitest';
import { parseRegistrarCsv, REGISTRAR_HEADER } from '../../src/domain/registrar';
import { ymd } from '../../src/domain/dates';

const H = REGISTRAR_HEADER.join(',');

describe('parseRegistrarCsv', () => {
  it('turns valid rows into credentials, keeping the registrar reference apart', () => {
    const { records, errors } = parseRegistrarCsv(`${H}\nS-001,1999-04-17,11,11620,Y,N,120,2027-03-31\n\nS-002,2001-12-01,28,28110,true,false,80,2027-02-28\n`);
    expect(errors).toEqual([]);
    expect(records).toEqual([
      { line: 2, holderRef: 'S-001', credential: { birthDate: ymd(1999, 4, 17), sido: 11, sigungu: 11620, student: true, employed: false, incomePct: 120, validUntil: ymd(2027, 3, 31) } },
      { line: 4, holderRef: 'S-002', credential: { birthDate: ymd(2001, 12, 1), sido: 28, sigungu: 28110, student: true, employed: false, incomePct: 80, validUntil: ymd(2027, 2, 28) } },
    ]);
  });

  it('rejects each bad row with its line number and a reason; good rows still pass', () => {
    const csv = [
      H,
      'S-1,1999-02-30,11,11620,Y,N,120,2027-03-31', // 2: impossible date
      'S-2,1999-04-17,99,11620,Y,N,120,2027-03-31', // 3: unknown province
      'S-3,1999-04-17,11,26110,Y,N,120,2027-03-31', // 4: district outside province
      'S-4,1999-04-17,11,11620,maybe,N,120,2027-03-31', // 5: not a yes/no
      'S-5,1999-04-17,11,11620,Y,N,-4,2027-03-31', // 6: income out of range
      'S-6,1999-04-17,11,11620,Y,N,120', // 7: missing column
      'S-7,1999-04-17,11,11620,Y,N,120,2027-03-31', // 8: ok
      'S-7,2000-01-01,11,11620,Y,N,100,2027-03-31', // 9: duplicate reference (one credential per person)
      'bad ref!,1999-04-17,11,11620,Y,N,120,2027-03-31', // 10: reference not [A-Za-z0-9_-]
    ].join('\n');
    const { records, errors } = parseRegistrarCsv(csv);
    expect(records.map((r) => r.line)).toEqual([8]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7, 9, 10]);
    for (const e of errors) expect(e.reason.length).toBeGreaterThan(5);
  });

  it('refuses a file whose header is not the agreed one', () => {
    expect(() => parseRegistrarCsv('id,dob\nS-1,1999-04-17')).toThrow(/header/);
  });
});
