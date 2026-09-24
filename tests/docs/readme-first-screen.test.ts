// AC-21 — what a judge sees before scrolling: tagline, live demo, 3-line quick start, test count, CI,
// both hackathon entries, licence. The stated test count is checked against a real run by
// scripts/check-test-count.mjs (CI); here every place that states it must state the same number.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const submission = readFileSync(join(root, 'docs/SUBMISSION.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { description: string };
const head = readme.split(/^## /m)[0]!;

describe('README first screen', () => {
  it('opens with the tagline (package.json description, also the Devpost elevator pitch ≤ 200 chars)', () => {
    expect(pkg.description.length).toBeLessThanOrEqual(200);
    expect(head).toContain(pkg.description);
  });

  it('links the live demo in English and Korean, and the grant preset', () => {
    expect(head).toContain('https://ryugi62.github.io/justenough/?lang=en');
    expect(head).toContain('https://ryugi62.github.io/justenough/?lang=ko');
    expect(head).toContain('https://ryugi62.github.io/justenough/?lang=en&preset=grant');
  });

  it('has a 3-command quick start', () => {
    const block = /```bash\n([\s\S]*?)```/.exec(head)?.[1] ?? '';
    const lines = block.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^git clone https:\/\/github\.com\/Ryugi62\/justenough/);
  });

  it('states the test count, the CI badge, both hackathon entries and the licence', () => {
    expect(head).toMatch(/\*\*\d+ tests\*\*/);
    expect(head).toContain('actions/workflows/ci.yml/badge.svg');
    expect(head).toContain('Hackathon entries: Midnight Korea Hackathon 2026, 3rd-Web-Hack');
    expect(head).toContain('Apache-2.0');
  });

  it('every stated test count is the same number', () => {
    const counts = [
      ...[...readme.matchAll(/\*\*(\d+) tests\*\*/g)].map((m) => m[1]),
      ...[...readme.matchAll(/^## Tests \((\d+)\)/gm)].map((m) => m[1]),
      ...[...readme.matchAll(/-> (\d+) tests ->/g)].map((m) => m[1]),
      ...[...submission.matchAll(/-> (\d+) tests ->/g)].map((m) => m[1]),
    ];
    expect(counts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(counts).size).toBe(1);
  });
});
