// AC-18 — the demo's message catalogues: same keys in both languages, no Hangul in English.
// The headless walk in scripts/demo-flow.mjs checks the rendered page itself.
import { describe, expect, it } from 'vitest';
import { langFrom, MESSAGES } from '../../web/i18n';

const HANGUL = /[가-힣ㄱ-ㆎ]/;

/** Every string reachable from a message value; functions are called with representative arguments. */
function strings(v: unknown, path = ''): Array<[string, string]> {
  if (typeof v === 'string') return [[path, v]];
  if (typeof v === 'function') {
    const out: Array<[string, string]> = [];
    for (const args of [[3, 5, 'x', 'y'], [0, 0, '', ''], [true, 1, 'x', 'y'], [false, 1, 'x', 'y']]) {
      out.push(...strings((v as (...a: unknown[]) => unknown)(...args), `${path}()`));
    }
    return out;
  }
  if (v instanceof RegExp) return [];
  if (Array.isArray(v)) return v.flatMap((x, i) => strings(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, path ? `${path}.${k}` : k));
  return [];
}

describe('MESSAGES', () => {
  it('both catalogues have exactly the same keys', () => {
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(MESSAGES.en)).toEqual(keys(MESSAGES.ko));
    for (const k of Object.keys(MESSAGES.ko) as Array<keyof typeof MESSAGES.ko>) {
      const ko = MESSAGES.ko[k];
      const en = MESSAGES.en[k];
      if (ko && typeof ko === 'object' && !Array.isArray(ko) && !(ko instanceof RegExp)) expect(keys(en as object), k).toEqual(keys(ko));
      if (Array.isArray(ko)) expect((en as unknown[]).length, k).toBe(ko.length);
    }
  });

  it('no English message contains Hangul outside lang="ko" markup (and the switch back to Korean)', () => {
    const outsideKo = (s: string) => s.replace(/<(\w+)[^>]*\blang="ko"[^>]*>[\s\S]*?<\/\1>/g, '');
    const bad = strings(MESSAGES.en).filter(([path, s]) => HANGUL.test(outsideKo(s)) && path !== 'switchLangLabel');
    expect(bad).toEqual([]);
  });

  it('no message is empty', () => {
    for (const lang of ['ko', 'en'] as const) {
      const empty = strings(MESSAGES[lang]).filter(([p, s]) => s.trim() === '' && !p.endsWith('()'));
      expect(empty, lang).toEqual([]);
    }
  });
});

describe('langFrom', () => {
  it('?lang= wins, then the browser language; non-Korean browsers get English', () => {
    expect(langFrom('?lang=en', 'ko-KR')).toBe('en');
    expect(langFrom('?preset=grant&lang=ko', 'en-US')).toBe('ko');
    expect(langFrom('', 'ko-KR')).toBe('ko');
    expect(langFrom('', 'ko')).toBe('ko');
    expect(langFrom('', 'en-GB')).toBe('en');
    expect(langFrom('?lang=fr', 'de-DE')).toBe('en');
    expect(langFrom('', undefined)).toBe('ko');
  });
});
