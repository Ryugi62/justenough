// AC-14 — judges check that the submission form text matches the README (hub, "How we review" step 02).
// docs/SUBMISSION.md is the single source for the form; README must carry the same paragraphs verbatim.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const submission = readFileSync(join(root, 'docs/SUBMISSION.md'), 'utf8');

function section(md: string, heading: string): string {
  const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  const m = md.match(re);
  if (!m) throw new Error(`missing section "${heading}"`);
  return m[1]!.trim();
}

describe('README ↔ submission form', () => {
  for (const h of ['One-line description', 'How Midnight is used', 'How to run']) {
    it(`"${h}" is identical`, () => {
      const s = section(submission, h);
      expect(s.length).toBeGreaterThan(20);
      expect(section(readme, h)).toBe(s);
    });
  }

  it('the project name matches', () => {
    expect(section(readme, 'Project name')).toBe(section(submission, 'Project name'));
  });

  it('README declares the licence and the midnightntwrk topic requirement', () => {
    expect(readme).toMatch(/Apache-2\.0/);
    expect(readme).toMatch(/midnightntwrk/);
  });
});
