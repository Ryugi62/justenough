// Scans what an observer can read — a ledger state dump or a public transcript — for attribute
// values. Every public value is a list of little-endian byte atoms, so we decode atoms and compare
// numbers exactly (a substring search would "find" 120 inside any hash).

/** Atoms from `StateValue.toString()` output: `<[0dd12f01, 0c423201, -, …]: b4b4…>`. */
export function atomsFromStateDump(raw: string): string[] {
  return [...raw.matchAll(/<\[([^\]]*)\]/g)].flatMap((m) => m[1]!.split(',').map((s) => s.trim().replace(/^-$/, '')));
}

/** Atoms from a JSON-serialised public transcript (AlignedValue objects: { value: hex[], alignment }). */
export function atomsFromTranscriptJson(json: string): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      const o = v as { value?: unknown; alignment?: unknown };
      if (Array.isArray(o.value) && Array.isArray(o.alignment)) out.push(...(o.value as string[]).filter((x) => typeof x === 'string'));
      Object.values(o).forEach(walk);
    }
  };
  walk(JSON.parse(json));
  return out;
}

export function littleEndian(hex: string): bigint {
  return hex === '' ? 0n : BigInt('0x' + hex.match(/../g)!.reverse().join(''));
}

/** Needles found among atoms short enough to hold them (≤ 8 bytes). */
export function attributeValuesIn(atoms: readonly string[], needles: readonly (number | bigint)[]): bigint[] {
  const wanted = new Set(needles.map((n) => BigInt(n)));
  const found = new Set<bigint>();
  for (const a of atoms) {
    if (a.length > 16 || !/^[0-9a-f]*$/i.test(a)) continue;
    const v = littleEndian(a);
    if (wanted.has(v)) found.add(v);
  }
  return [...found];
}
