// AC-13 — Clean Architecture: dependencies point inward only.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function imports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

describe('layering', () => {
  it('domain depends on nothing outside the domain (no SDK, no I/O)', () => {
    const files = tsFiles(join(root, 'src/domain'));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      for (const i of imports(f)) {
        expect(i.startsWith('./'), `${f} imports ${i}`).toBe(true);
      }
    }
  });

  it('application depends only on the domain and its own ports', () => {
    for (const f of tsFiles(join(root, 'src/application'))) {
      for (const i of imports(f)) {
        const ok = i.startsWith('./') || i.startsWith('../domain/');
        expect(ok, `${f} imports ${i}`).toBe(true);
      }
    }
  });

  it('only adapters touch the Midnight runtime or the generated contract', () => {
    const offenders = [...tsFiles(join(root, 'src/domain')), ...tsFiles(join(root, 'src/application'))].filter((f) =>
      imports(f).some((i) => i.includes('@midnight-ntwrk') || i.includes('managed/')),
    );
    expect(offenders).toEqual([]);
  });
});
