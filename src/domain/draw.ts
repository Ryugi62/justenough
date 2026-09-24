// 추첨 — receipts are ranked by ticket = hash(seed, receipt). The seed is committed when the
// programme is registered (before any receipt exists) and revealed when it closes, so anyone
// can recompute which receipts had to be selected.

export interface TicketEntry {
  receipt: string;
  /** hex; compared lexicographically, which equals big-endian byte order for equal lengths */
  ticket: string;
}

function ranked(entries: readonly TicketEntry[]): TicketEntry[] {
  const lengths = new Set(entries.map((e) => e.ticket.length));
  if (lengths.size > 1) throw new Error('All tickets must have the same length');
  return [...entries].sort((a, b) => (a.ticket < b.ticket ? -1 : a.ticket > b.ticket ? 1 : 0));
}

export function selectByTickets(entries: readonly TicketEntry[], k: number): string[] {
  return ranked(entries)
    .slice(0, Math.max(0, k))
    .map((e) => e.receipt);
}

export interface AuditResult {
  ok: boolean;
  expected: string[];
  /** selected but not among the lowest tickets */
  unexpected: string[];
  /** among the lowest tickets but not selected */
  missing: string[];
}

export function auditSelection(entries: readonly TicketEntry[], selected: readonly string[], k: number): AuditResult {
  const expected = selectByTickets(entries, k);
  const exp = new Set(expected);
  const sel = new Set(selected);
  const unexpected = selected.filter((r) => !exp.has(r));
  const missing = expected.filter((r) => !sel.has(r));
  return { ok: unexpected.length === 0 && missing.length === 0, expected, unexpected, missing };
}
