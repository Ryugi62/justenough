// The privacy check itself must be right: decode atoms, compare numbers, no substring luck.
import { describe, expect, it } from 'vitest';
import { atomsFromStateDump, atomsFromTranscriptJson, attributeValuesIn, littleEndian } from '../../src/adapters/leak-scan';

describe('leak scan', () => {
  it('decodes little-endian atoms the way the ledger stores them', () => {
    expect(littleEndian('3c283501')).toBe(20260924n);
    expect(littleEndian('')).toBe(0n);
  });

  it('does not flag a hash that merely contains the digits or hex of a value', () => {
    const hash = '7b144ed9c424f4deca0fbe9f7917ee00673635dfae49b8749f4e8874115787b1'; // contains "7b" (= 123) and "120"
    expect(attributeValuesIn([hash], [123, 120])).toEqual([]);
  });

  it('flags an atom that encodes an attribute value', () => {
    expect(attributeValuesIn(['7b', '3c283501'], [123, 20260924, 5])).toEqual([123n, 20260924n]);
  });

  it('reads atoms from state dumps and transcripts', () => {
    expect(atomsFromStateDump('Map { <[64656d6f]: b32>: <[0dd12f01, -, 96]: b4b1b1> }')).toEqual(['64656d6f', '0dd12f01', '', '96']);
    const t = JSON.stringify([{ popeq: { result: { value: ['96', '3c283501'], alignment: [] } } }]);
    expect(atomsFromTranscriptJson(t)).toEqual(['96', '3c283501']);
  });
});
