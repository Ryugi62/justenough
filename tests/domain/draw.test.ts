// 추첨 — receipts are ranked by a ticket hash(seed, receipt); the seed was committed at registration.
import { describe, expect, it } from 'vitest';
import { auditSelection, selectByTickets } from '../../src/domain/draw';

const entries = [
  { receipt: 'r1', ticket: 'c0' },
  { receipt: 'r2', ticket: '0a' },
  { receipt: 'r3', ticket: 'ff' },
  { receipt: 'r4', ticket: '3b' },
  { receipt: 'r5', ticket: '0b' },
];

describe('selectByTickets', () => {
  it('picks the k lowest tickets', () => {
    expect(selectByTickets(entries, 3)).toEqual(['r2', 'r5', 'r4']);
  });

  it('caps at the pool size, handles empty pools, never mutates input', () => {
    const copy = JSON.stringify(entries);
    expect(selectByTickets(entries, 99)).toHaveLength(5);
    expect(selectByTickets([], 3)).toEqual([]);
    expect(JSON.stringify(entries)).toBe(copy);
  });

  it('rejects tickets of unequal length (would break the ordering)', () => {
    expect(() => selectByTickets([...entries, { receipt: 'x', ticket: 'abc' }], 1)).toThrow();
  });
});

describe('auditSelection', () => {
  it('confirms an honest selection', () => {
    expect(auditSelection(entries, ['r5', 'r2'], 2)).toEqual({ ok: true, expected: ['r2', 'r5'], unexpected: [], missing: [] });
  });

  it('flags a selection that skipped a lower ticket', () => {
    const r = auditSelection(entries, ['r2', 'r4'], 2);
    expect(r.ok).toBe(false);
    expect(r.unexpected).toEqual(['r4']);
    expect(r.missing).toEqual(['r5']);
  });
});
