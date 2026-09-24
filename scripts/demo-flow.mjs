// Physical check of the browser demo: builds nothing, serves ./dist, clicks through every step in
// Korean and English (youth allowance and the Web3 community grant preset), asserts what the screen
// says, and saves screenshots (390 px and 1280 px).
// AC-18: in English runs, every text node and label outside lang="ko" must be free of Hangul.
// Usage: node scripts/demo-flow.mjs [--video] [--out docs/screenshots] [--only en]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/screenshots';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const video = args.includes('--video');

const T = {
  ko: {
    intro: '자격만 증명해요', issue: '자격 증명이 발급됐어요', program: '공고 조건은 원래 공개돼 있어요',
    applyBefore: '제출하는 건 증명 1개예요', applied: '신청됐어요', receipt: '내 신청 영수증', tryAgain: '같은 공고에 한 번 더 내 보기',
    duplicate: '이미 신청했어요', cheat: '조건이 안 되면 증명이 만들어지지 않아요', submitAnyway: '그래도 제출해 보기',
    ineligible: '증명을 만들 수 없어요', forge: /값 바꿔 내 보기/, forged: '발급된 적 없는 증명이에요',
    draw: '기관은 영수증만 보고 추첨해요', audit: '공개 시드로 누구나 다시 계산한 결과', selected: '선정됐어요',
    claimed: '수령까지 끝났어요', claimRefused: '수령 증명이 거절됐어요', privateTab: 'A의 기기 · A만', scanOk: '비공개 값은 0개',
  },
  en: {
    intro: 'not who you are', issue: 'credential is issued', program: 'The rule is public anyway',
    applyBefore: 'You submit one proof, nothing else', applied: 'personal fields the institution received', receipt: 'my receipt', tryAgain: 'Try applying again',
    duplicate: 'Already applied', cheat: "If you don't qualify, no proof can be made", submitAnyway: 'Submit anyway',
    ineligible: 'The circuit will not accept values that fail the rule', forge: /^Change it to/, forged: 'This credential was never issued',
    draw: 'The operator draws receipts, not people', audit: 'Anyone can recompute it from the public seed', selected: 'You were selected',
    claimed: 'documents the institution received', claimRefused: 'Claim refused', privateTab: "A's device only", scanOk: "0 of A's private values found",
  },
};

const RUNS = [
  { tag: 'm390', width: 390, height: 844, lang: 'ko', preset: 'youth', dir: outDir },
  { tag: 'd1280', width: 1280, height: 800, lang: 'ko', preset: 'youth', dir: outDir },
  { tag: 'm390', width: 390, height: 844, lang: 'en', preset: 'youth', dir: join(outDir, 'en') },
  { tag: 'd1280', width: 1280, height: 800, lang: 'en', preset: 'youth', dir: join(outDir, 'en') },
  { tag: 'm390', width: 390, height: 844, lang: 'en', preset: 'grant', dir: join(outDir, 'grant-en') },
  { tag: 'd1280', width: 1280, height: 800, lang: 'en', preset: 'grant', dir: join(outDir, 'grant-en') },
].filter((r) => !only || r.lang === only);

const server = await preview({ root: 'web', build: { outDir: '../dist' }, preview: { port: 4173, strictPort: false }, logLevel: 'error' });
const url = server.resolvedUrls.local[0];

const launch = {};
if (process.env.PW_CHROMIUM_PATH) launch.executablePath = process.env.PW_CHROMIUM_PATH;
const browser = await chromium.launch(launch);

/** Hangul outside lang="ko" elements, in text nodes and in title / aria-label attributes. */
async function hangulOutsideKo(page) {
  return page.evaluate(() => {
    const H = /[가-힣ㄱ-ㆎ]/;
    const bad = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (H.test(n.textContent) && !n.parentElement.closest('[lang="ko"]')) bad.push(n.textContent.trim().slice(0, 60));
    }
    for (const el of document.querySelectorAll('[title],[aria-label]')) {
      for (const a of ['title', 'aria-label']) {
        const v = el.getAttribute(a);
        if (v && H.test(v) && !el.closest('[lang="ko"]')) bad.push(`@${a}: ${v.slice(0, 60)}`);
      }
    }
    if (H.test(document.title)) bad.push(`<title>: ${document.title}`);
    return bad;
  });
}

async function run({ tag, width, height, lang, preset, dir }) {
  mkdirSync(dir, { recursive: true });
  const t = T[lang];
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: lang === 'ko' ? 'ko-KR' : 'en-US',
    ...(video ? { recordVideo: { dir: join(dir, 'video'), size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  const hangul = new Set();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?lang=${lang}${preset === 'youth' ? '' : `&preset=${preset}`}`);
  const cta = page.locator('footer.cta button.primary');
  const expectText = async (s) => {
    await page.getByText(s, { exact: false }).first().waitFor({ timeout: 15000 });
  };
  const shot = async (name) => {
    if (lang === 'en') for (const h of await hangulOutsideKo(page)) hangul.add(`${name}: ${h}`);
    await page.screenshot({ path: join(dir, `${tag}-${name}.png`), fullPage: true });
  };
  const pause = (ms) => page.waitForTimeout(video ? ms : 50);
  // the inspector is collapsed on phones: the scan line must exist and read "0 found" either way
  const expectScanOk = async () => {
    const scan = page.locator('.scan').first();
    await scan.waitFor({ state: 'attached', timeout: 15000 });
    const text = await scan.textContent();
    if (!text.includes(t.scanOk)) throw new Error(`chain scan: ${text}`);
  };

  await expectText(t.intro);
  await expectScanOk();
  await shot('0-intro');
  await pause(2500);
  await cta.click();
  await expectText(t.issue);
  await shot('1-issue');
  await pause(2500);
  await cta.click();
  await expectText(t.program);
  await shot('2-program');
  await pause(2500);
  await cta.click();
  await expectText(t.applyBefore);
  await shot('3a-before-apply');
  await pause(2000);
  await cta.click(); // apply → runs the `apply` circuit
  await expectText(t.applied);
  await expectText(t.receipt);
  await expectScanOk();
  await shot('3b-applied');
  await pause(2000);
  await page.getByRole('button', { name: t.tryAgain }).click();
  await expectText(t.duplicate);
  await shot('3c-duplicate');
  await pause(2000);
  await cta.click();
  await expectText(t.cheat);
  await page.getByRole('button', { name: t.submitAnyway }).click();
  await expectText(t.ineligible);
  await shot('4a-ineligible');
  await pause(2000);
  await page.getByRole('button', { name: t.forge }).click();
  await expectText(t.forged);
  await shot('4b-forged');
  await pause(2000);
  await cta.click();
  await expectText(t.draw);
  await shot('5a-receipts');
  await pause(1500);
  await cta.click(); // draw
  await expectText(t.audit);
  await shot('5b-drawn');
  await pause(2000);
  await cta.click();
  const selected = await page.getByText(t.selected).count();
  await shot('6a-result');
  await pause(1500);
  await cta.click(); // claim
  if (selected) {
    await expectText(t.claimed);
    await shot('6b-claimed');
  } else {
    await expectText(t.claimRefused);
    await shot('6b-claim-refused');
  }
  await pause(3000);
  if (width >= 960) {
    await page.getByRole('tab', { name: t.privateTab }).click();
    await shot('7-inspector-private');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();
  return { tag, lang, preset, selected: !!selected, overflow, errors, hangul: [...hangul] };
}

const results = [];
for (const r of RUNS) results.push(await run(r));
await browser.close();
server.httpServer.close();
console.log(JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.overflow > 0 || r.errors.length || r.hangul.length);
if (bad.length) {
  console.error('FAILED', JSON.stringify(bad, null, 1));
  process.exit(1);
}
console.log(`OK: ${results.length} runs, 0 overflow, 0 page errors, 0 Hangul outside lang="ko" in English runs`);
