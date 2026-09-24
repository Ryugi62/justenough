// Program ids are 32 bytes on the ledger. We use the notice slug itself (ASCII, zero-padded),
// so anyone reading the public ledger sees which notice a programme belongs to.

export function programIdOf(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Program slug must be lowercase ASCII: ${slug}`);
  if (slug.length > 32) throw new Error(`Program slug longer than 32 bytes: ${slug}`);
  let hex = '';
  for (let i = 0; i < 32; i++) hex += (i < slug.length ? slug.charCodeAt(i) : 0).toString(16).padStart(2, '0');
  return hex;
}

export function slugOfProgramId(hex: string): string {
  let s = '';
  for (let i = 0; i < hex.length; i += 2) {
    const c = parseInt(hex.slice(i, i + 2), 16);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}
