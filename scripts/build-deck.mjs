// Render docs/deck/deck.html (1280x720 slides) to docs/deck/JustEnough-deck.pdf with headless Chromium.
// The real-network slide is filled from docs/devnet-run.json so the deck never drifts from the evidence.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const run = JSON.parse(readFileSync('docs/devnet-run.json', 'utf8'));
const sec = (ms) => (ms ? `${(ms / 1000).toFixed(1)}초` : '—');
const step = (name) => run.steps.find((s) => s.step === name) ?? {};
const rows = [
  ['deploy (발급기관)', 'ok', '확정', step('deploy').blockHeight, '—'],
  ['issueCredential × 2 (해시만)', 'ok', '확정', `${step('issueCredential(a)').blockHeight} · ${step('issueCredential(b)').blockHeight}`, `${sec(step('issueCredential(a)').provingAndSubmitMs)} · ${sec(step('issueCredential(b)').provingAndSubmitMs)}`],
  ['registerProgram (정책 + 시드 약속)', 'ok', '확정', step('registerProgram').blockHeight, sec(step('registerProgram').provingAndSubmitMs)],
  ['apply (지원자 A)', 'ok', '확정 · 영수증 1건', step('apply(A)').blockHeight, sec(step('apply(A)').provingAndSubmitMs)],
  ['apply (지원자 B, 취업 중) · A 재신청', 'no', '회로가 거절 — 트랜잭션 자체가 안 만들어짐', '—', '—'],
  ['closeProgram (시드 공개)', 'ok', step('closeProgram').commitmentMatches ? '확정 · 약속과 일치' : '확정 · 불일치', step('closeProgram').blockHeight, '—'],
  ['selectApplicant (최저 티켓) · claimBenefit', 'ok', '확정', `${step('selectApplicant').blockHeight} · ${step('claimBenefit(A)').blockHeight}`, `— · ${sec(step('claimBenefit(A)').provingAndSubmitMs)}`],
];
const txs = run.steps.filter((s) => s.txId).length;
const leaks = step('indexer state').attributeValuesFoundInPublicState;

const launch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file://' + resolve('docs/deck/deck.html'));
await page.evaluate(
  ({ rows, txs, leaks }) => {
    const t = document.getElementById('devnet-table');
    for (const [name, tone, result, block, time] of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${name}</td><td class="${tone}">${result}</td><td>${block}</td><td>${time}</td>`;
      t.appendChild(tr);
    }
    const sum = document.getElementById('devnet-summary');
    sum.innerHTML = sum.innerHTML.replace(/<b>\d+건<\/b>, 인덱서/, `<b>${txs}건</b>, 인덱서`).replace(/속성 값 <b>\d+건<\/b>/, `속성 값 <b>${leaks}건</b>`);
  },
  { rows, txs, leaks },
);
await page.pdf({ path: 'docs/deck/JustEnough-deck.pdf', width: '1280px', height: '720px', printBackground: true });
await browser.close();
console.log('docs/deck/JustEnough-deck.pdf', { txs, leaks });
