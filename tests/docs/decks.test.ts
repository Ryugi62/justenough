// AC-22 — both decks live in the repository, and the Midnight deck states the same test count as the README.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const pages = (file: string) => (readFileSync(join(root, file)).toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
const readmeCount = /\*\*(\d+) tests\*\*/.exec(readFileSync(join(root, 'README.md'), 'utf8'))?.[1];

describe('decks', () => {
  it('Midnight deck: PDF with at least 10 slides', () => {
    expect(pages('docs/deck/JustEnough-deck.pdf')).toBeGreaterThanOrEqual(10);
  });

  it('3rd-Web-Hack deck: PDF with the 7 slides the brief asks for', () => {
    expect(pages('docs/3rd-web-hack-deck.pdf')).toBe(7);
  });

  it('the Midnight deck source states the README test count and no other', () => {
    const html = readFileSync(join(root, 'docs/deck/deck.html'), 'utf8');
    const stated = [...html.matchAll(/(\d+)(?:<\/b>(?:<span>)?)?\s*(?:자동 테스트|개 테스트|테스트|tests)/g)].map((m) => m[1]);
    expect(stated.length).toBeGreaterThanOrEqual(1);
    expect(new Set(stated)).toEqual(new Set([readmeCount]));
  });
});
