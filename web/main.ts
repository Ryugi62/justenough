// JustEnough browser demo. The compiled Compact contract runs in this page (compact-runtime + WASM).
// Language: ?lang=ko|en (default: the browser's). Scenario: ?preset=youth|grant (default youth).
import { applyToProgram, auditDraw, claimBenefit, drawAndSelect } from '../src/application/use-cases';
import { describeAgeBand, explainEligibility, type Check, type Credential } from '../src/domain/eligibility';
import { NOTICE_CLAUSES, policyFromClause, type NoticeClause } from '../src/domain/notices';
import { ageOn, formatYMD } from '../src/domain/dates';
import { districtName, sidoName } from '../src/domain/regions';
import { slugOfProgramId } from '../src/domain/program-id';
import { failingPredicates, forgeToPass, presetFrom } from '../src/domain/presets';
import { bytesToHex, hexToBytes, toContractCredential } from '../src/adapters/simulator/mapping';
import { contractTicketHasher, SimulatedHolder } from '../src/adapters/simulator/ports';
import { chainView, privateNeedles } from '../src/adapters/simulator/chain-view';
import { createWorld, lastTx, type World } from './world';
import { langFrom, MESSAGES, type Messages } from './i18n';
import devnetRun from '../docs/devnet-run.json';

type Notice = { tone: 'ok' | 'no' | 'info'; title: string; body: string } | null;

const lang = langFrom(location.search, navigator.language);
const m: Messages = MESSAGES[lang];
const presetId = presetFrom(location.search);
document.documentElement.lang = lang;
document.title = m.htmlTitle;

const state: {
  world?: World;
  step: number;
  applied?: string;
  notice: Notice;
  picked: string[];
  claimed: boolean;
  inspector: 'public' | 'private';
  busy: boolean;
} = { step: 0, notice: null, picked: [], claimed: false, inspector: 'public', busy: false };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const short = (hex: string) => `${hex.slice(0, 6)}…${hex.slice(-4)}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function explainError(e: unknown): Notice {
  const msg = e instanceof Error ? e.message : String(e);
  for (const [re, title, body] of m.errors) if (re.test(msg)) return { tone: 'no', title, body: `${body} <code>${esc(re.source)}</code>` };
  return { tone: 'no', title: m.errorFallback, body: `<code>${esc(msg)}</code>` };
}

function applicantCount(w: World): number {
  return w.view.receipts(w.programId).length;
}

function policyOf(w: World) {
  return w.view.program(w.programId)!.policy;
}

/** Link to this page with one query parameter changed (keeps the other one). */
function hrefWith(key: 'lang' | 'preset', value: string): string {
  const p = new URLSearchParams(location.search);
  p.set(key, value);
  return `?${p.toString()}`;
}

// ---------------------------------------------------------------- pieces

function checksHtml(checks: Check[], showMine: boolean): string {
  return `<ul class="checks">${checks
    .map(
      (c) => `<li class="check ${c.ok ? 'ok' : 'no'}">
        <span class="mark" aria-hidden="true">${c.ok ? '✓' : '✕'}</span>
        <span class="check-main"><b>${m.pred[c.predicate]}</b><span>${esc(c.requirement)}</span></span>
        ${showMine ? `<span class="mine" title="${esc(m.mineTitle)}">${esc(c.mine)}</span>` : ''}
      </li>`,
    )
    .join('')}</ul>`;
}

function credentialCard(c: Credential, ref: number): string {
  const L = m.credLabels;
  const rows: Array<[string, string]> = [
    [L.birth, m.credBirth(formatYMD(c.birthDate), ageOn(c.birthDate, ref))],
    [L.place, m.credPlace(sidoName(c.sido, lang), districtName(c.sigungu, lang))],
    [L.student, m.credStudent(c.student)],
    [L.employed, m.credEmployed(c.employed)],
    [L.income, m.credIncome(c.incomePct)],
    [L.valid, m.credValid(formatYMD(c.validUntil))],
  ];
  return `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

function chips(policyText: string[]): string {
  return `<div class="chips">${policyText.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`;
}

function policyChips(clause: NoticeClause): string[] {
  const p = policyFromClause(clause);
  const out: string[] = [];
  if (p.minBirthDate !== 0 || p.maxBirthDate !== p.referenceDate) out.push(describeAgeBand(p, lang));
  if (p.sigungu) out.push(m.chipLivesIn(districtName(p.sigungu, lang)));
  else if (p.sido) out.push(m.chipLivesIn(sidoName(p.sido, lang)));
  if (p.requireStudent) out.push(m.chipStudent);
  if (p.requireUnemployed) out.push(m.chipUnemployed);
  if (p.maxIncomePct) out.push(m.chipIncome(p.maxIncomePct));
  return out;
}

const isSynthetic = (c: NoticeClause) => c.sourceUrl.includes('example.invalid');

/** Programme name + quote. Real notices keep the verbatim Korean quote (lang="ko") with an English gloss. */
function clauseHtml(c: NoticeClause): string {
  if (lang === 'ko') return `<p class="label">${esc(c.program)}</p><blockquote>${esc(c.quote)}</blockquote>`;
  if (isSynthetic(c)) return `<p class="label">${esc(c.en.program)}</p><blockquote>${esc(c.en.quote)}</blockquote>`;
  return `<p class="label">${esc(c.en.program)}</p><blockquote>${esc(c.en.quote)}</blockquote>
    <p class="sub">${esc(m.koreanOriginal)}: <span lang="ko">${esc(c.quote)}</span></p>`;
}

function noticeHtml(): string {
  const n = state.notice;
  if (!n) return '';
  return `<div class="notice ${n.tone}" role="status"><b>${esc(n.title)}</b><p>${n.body}</p></div>`;
}

// ---------------------------------------------------------------- steps

function stepIntro(w: World): string {
  return `
    <p class="eyebrow">${m.introEyebrow}</p>
    <h1>${m.introTitle}</h1>
    <div class="card hero-number">
      <p class="big">0${lang === 'ko' ? '<small>개</small>' : ''}</p>
      <p class="caption">${m.heroCaption}</p>
      <p class="sub">${m.introProblem[w.preset.id]}</p>
    </div>
    <ol class="how">${m.introHow.map((h) => `<li>${h}</li>`).join('')}</ol>
    <details><summary>${m.introWhatRunsSummary}</summary><p>${m.introWhatRunsBody}</p></details>`;
}

function stepIssue(w: World): string {
  const commitment = bytesToHex(w.a.party.commitment());
  return `
    <p class="eyebrow">${m.issueEyebrow}</p>
    <h1>${m.issueTitle}</h1>
    <section class="card private">
      <h2><span class="tag lock">${m.tagPrivate}</span></h2>
      ${credentialCard(w.preset.applicantA, policyOf(w).referenceDate)}
    </section>
    <section class="card public">
      <h2><span class="tag globe">${m.tagPublic}</span></h2>
      <p class="big-inline">${m.oneHash}</p>
      <p class="mono">${short(commitment)}</p>
      <p class="sub">${m.issuedSoFar(w.view.issuedCount())}</p>
    </section>
    <details><summary>${m.whyHashSummary}</summary><p>${m.whyHashBody}</p></details>`;
}

function stepProgram(w: World): string {
  const prog = w.view.program(w.programId)!;
  return `
    <p class="eyebrow">${m.programEyebrow}</p>
    <h1>${m.programTitle}</h1>
    <p class="lead">${m.programLead}</p>
    <section class="card">
      ${clauseHtml(w.preset.clause)}
      ${chips(policyChips(w.preset.clause))}
      <div class="stats"><div><b>${m.places(prog.capacity)}</b><span>${m.placesLabel}</span></div><div><b>${m.appliedSoFar(applicantCount(w))}</b><span>${m.appliedSoFarLabel}</span></div></div>
    </section>
    <details><summary>${m.realNoticesSummary(NOTICE_CLAUSES.length)}</summary>
      <ul class="clauses">${NOTICE_CLAUSES.map((c) => {
        const notCovered = lang === 'ko' ? c.notCovered : c.en.notCovered;
        return `<li>${clauseHtml(c)}${chips(policyChips(c))}${
          notCovered.length ? `<p class="sub">${m.outsideCircuit}: ${notCovered.map(esc).join(' · ')}</p>` : ''
        }<p class="src"><a href="${c.sourceUrl}" target="_blank" rel="noopener">${m.source}</a> · ${m.checkedOn(c.retrieved)}</p></li>`;
      }).join('')}</ul>
    </details>`;
}

function stepApply(w: World): string {
  const report = explainEligibility(w.preset.applicantA, policyOf(w), lang);
  if (state.applied) {
    return `
    <p class="eyebrow">${m.applyEyebrow}</p>
    <h1>${m.applyTitleAfter}</h1>
    <section class="card result">
      <p class="big">0${lang === 'ko' ? '<small>개</small>' : ''}</p>
      <p class="caption">${m.zeroCaptionAfter}</p>
      <div class="stats"><div><b class="mono">${short(state.applied)}</b><span>${m.myReceipt}</span></div><div><b>${applicantCount(w)}</b><span>${m.applications}</span></div></div>
      <button class="ghost" data-action="apply-again">${m.tryAgain}</button>
    </section>
    ${noticeHtml()}
    <details><summary>${m.conditionsSummary(report.checks.length)}</summary>${checksHtml(report.checks, true)}</details>`;
  }
  return `
    <p class="eyebrow">${m.applyEyebrow}</p>
    <h1>${m.applyTitleBefore}</h1>
    <p class="lead">${m.applyLead}</p>
    ${checksHtml(report.checks, true)}`;
}

function cheatParts(w: World) {
  const policy = policyOf(w);
  const b = w.preset.applicantB;
  const failing = failingPredicates(b, policy)[0]!;
  const forged = forgeToPass(b, policy);
  const mineOf = (c: Credential) => explainEligibility(c, policy, lang).checks.find((x) => x.predicate === failing)!.mine;
  return { policy, b, forged, bValue: mineOf(b), passingValue: mineOf(forged) };
}

function stepCheat(w: World): string {
  const { policy, b, bValue, passingValue } = cheatParts(w);
  const report = explainEligibility(b, policy, lang);
  return `
    <p class="eyebrow">${esc(m.cheatEyebrow(bValue))}</p>
    <h1>${m.cheatTitle}</h1>
    ${checksHtml(report.checks, true)}
    <div class="row">
      <button class="secondary" data-action="cheat-submit">${m.submitAnyway}</button>
      <button class="secondary" data-action="cheat-forge">${esc(m.forgeButton(passingValue))}</button>
    </div>
    ${noticeHtml()}
    <p class="sub">${m.stillApplied(applicantCount(w))}</p>`;
}

function stepDraw(w: World): string {
  const receipts = w.view.receipts(w.programId);
  const picked = new Set(state.picked);
  const seed = w.view.drawSeed(w.programId);
  const audit = seed ? auditDraw(w.view, contractTicketHasher, w.programId) : undefined;
  const cap = w.preset.capacity;
  return `
    <p class="eyebrow">${m.drawEyebrow}</p>
    <h1>${m.drawTitle}</h1>
    <p class="lead">${m.drawLead(receipts.length, cap)}</p>
    <div class="receipts">${receipts
      .map((r) => `<span class="receipt ${picked.has(r.receipt) ? 'picked' : ''}">${short(r.receipt)}${picked.has(r.receipt) ? `<i>${m.picked}</i>` : ''}</span>`)
      .join('')}</div>
    <section class="card public">
      <h2><span class="tag globe">${m.verifiableDraw}</span></h2>
      <div class="stats">
        <div><b class="mono">${short(w.view.seedCommitment(w.programId))}</b><span>${m.seedCommitted}</span></div>
        <div><b class="mono">${seed ? short(seed) : m.seedRevealedAtClose}</b><span>${m.seedRevealed}</span></div>
      </div>
      ${
        audit
          ? `<p class="audit ${audit.ok ? 'ok' : 'no'}">${m.auditLine(audit.ok, audit.expected.length)}</p>`
          : `<p class="sub">${m.seedFixedNote}</p>`
      }
      <details><summary>${m.formulaSummary}</summary><p>${m.formulaBody(cap)}</p></details>
    </section>`;
}

function stepClaim(w: World): string {
  const mine = w.a.receiptFor(w.programId);
  const selected = state.picked.includes(mine);
  const total = applicantCount(w);
  const cap = w.preset.capacity;
  if (state.claimed) {
    return `
      <p class="eyebrow">${m.claimEyebrow}</p>
      <h1>${m.claimedTitle}</h1>
      <div class="grid4">
        <div class="card metric"><b>${m.metricDocs}</b><span>${m.metricDocsLabel}</span></div>
        <div class="card metric"><b>${m.metricLedger}</b><span>${m.metricLedgerLabel}</span></div>
        <div class="card metric"><b>${m.metricRejected(total - cap)}</b><span>${m.metricRejectedLabel}</span></div>
        <div class="card metric"><b>${m.metricCalls(w.net.txLog.length)}</b><span>${m.metricCallsLabel}</span></div>
      </div>
      <p class="lead">${m.payoutLead(cap)}</p>
      ${devnetCard(w)}`;
  }
  return `
    <p class="eyebrow">${m.claimEyebrow}</p>
    <h1>${m.selectedTitle(selected)}</h1>
    <p class="lead">${m.selectedLead(selected)}</p>
    <section class="card"><div class="stats"><div><b class="mono">${short(mine)}</b><span>${m.myReceipt}</span></div><div><b>${m.statusSelected(selected)}</b><span>${m.ledgerStatus}</span></div></div></section>
    ${noticeHtml()}`;
}

// ---------------------------------------------------------------- real network evidence

type DevnetStep = { step: string; txId?: string; blockHeight?: number; provingAndSubmitMs?: number; refused?: string; attributeValuesFoundInPublicState?: number };

function devnetCard(w: World): string {
  const steps = (devnetRun as { steps: DevnetStep[] }).steps;
  const txs = steps.filter((s) => s.txId);
  const apply = steps.find((s) => s.step === 'apply(A)');
  const refused = steps.filter((s) => s.refused);
  const indexer = steps.find((s) => s.step === 'indexer state');
  return `<section class="card public">
    <h2><span class="tag globe">${m.devnetTag}</span></h2>
    <p class="sub">${m.devnetBody}${w.preset.id === 'youth' ? '' : ` ${m.devnetPresetNote}`}</p>
    <div class="stats">
      <div><b>${m.devnetTxs(txs.length)}</b><span>${m.devnetTxsLabel}</span></div>
      <div><b>${apply?.provingAndSubmitMs ? m.devnetSeconds((apply.provingAndSubmitMs / 1000).toFixed(1)) : '-'}</b><span>${m.devnetApplyLabel}</span></div>
      <div><b>${m.devnetRefused(refused.length)}</b><span>${m.devnetRefusedLabel}</span></div>
      <div><b>${indexer?.attributeValuesFoundInPublicState === undefined ? '-' : m.devnetLeaks(indexer.attributeValuesFoundInPublicState)}</b><span>${m.devnetLeaksLabel}</span></div>
    </div>
    <details><summary>${m.devnetTxList}</summary><ul class="txs">${txs
      .map((t) => `<li><b>${esc(t.step)}</b> <span class="mono">${short(t.txId!)}</span> · ${m.block} ${t.blockHeight}</li>`)
      .join('')}</ul></details>
  </section>`;
}

// ---------------------------------------------------------------- inspector: what the chain sees (dual ledger)

function chainPanel(w: World): string {
  const cv = chainView(w.net, privateNeedles(w.preset.applicantA, policyOf(w)));
  const circuit = cv.circuit as keyof Messages['disclosedBy'] | undefined;
  const found = cv.privateValuesFound.length;
  return `<section class="chain" aria-live="polite">
    ${
      circuit && m.disclosedBy[circuit]
        ? `<p class="sub">${m.lastCall(circuit, cv.publicOps)}</p>
           <p class="chain-label">${m.disclosed}</p>
           <p class="disclosed">${m.disclosedBy[circuit]}</p>`
        : `<p class="sub">${m.chainNothingYet}</p>`
    }
    <p class="scan ${found ? 'no' : 'ok'}">${found ? m.scanFail(found) : m.scanOk(cv.atomsScanned)}</p>
    <p class="sub">${m.scanWhat}</p>
  </section>`;
}

function inspector(w: World): string {
  const l = w.net.ledger();
  const pid = hexToBytes(w.programId);
  const tx = lastTx(w);
  const aState = w.a.party.state;
  const pub = `
    ${chainPanel(w)}
    <dl class="kv small">
      <div><dt>issuer</dt><dd class="mono">${short(bytesToHex(l.issuer))}</dd></div>
      <div><dt>issuedCount</dt><dd>${l.issuedCount}</dd></div>
      <div><dt>credentials.root</dt><dd class="mono">${String(l.credentials.root().field).slice(0, 10)}…</dd></div>
      <div><dt>programs</dt><dd>${esc(slugOfProgramId(w.programId))} · ${l.programs.lookup(pid).status === 0 ? 'open' : 'closed'}</dd></div>
      <div><dt>applicantCount</dt><dd>${l.applicantCount.lookup(pid).read()}</dd></div>
      <div><dt>selectedCount</dt><dd>${l.selectedCount.lookup(pid).read()}</dd></div>
      <div><dt>applications</dt><dd>${m.receiptsHashes(Number(l.applications.lookup(pid).size()))}</dd></div>
    </dl>
    ${tx ? `<details><summary>${m.rawTranscript}</summary><pre>${esc(tx.publicTranscriptDump.slice(0, 4000))}</pre></details>` : ''}`;
  const priv = `
    <dl class="kv small">
      <div><dt>secret</dt><dd class="mono">${'•'.repeat(12)}</dd></div>
      <div><dt>salt</dt><dd class="mono">${'•'.repeat(12)}</dd></div>
    </dl>
    ${credentialCard(w.preset.applicantA, policyOf(w).referenceDate)}
    <p class="sub">${m.privateNote}</p>
    ${aState.credential ? `<details><summary>${m.privateInputs}</summary><pre>${esc(
      JSON.stringify({ credential: toSimple(aState.credential) }, null, 1),
    )}</pre></details>` : ''}`;
  return `
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="${state.inspector === 'public'}" data-action="tab-public">${m.tabPublic}</button>
      <button role="tab" aria-selected="${state.inspector === 'private'}" data-action="tab-private">${m.tabPrivate}</button>
    </div>
    <div class="tabpanel">${state.inspector === 'public' ? pub : priv}</div>`;
}

function toSimple(c: ReturnType<typeof toContractCredential>) {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]));
}

// ---------------------------------------------------------------- CTA + actions

function cta(): { label: string; action: string; disabled?: boolean } {
  const w = state.world!;
  switch (state.step) {
    case 0:
      return { label: m.cta.start, action: 'next' };
    case 1:
      return { label: m.cta.seeRule, action: 'next' };
    case 2:
      return { label: m.cta.applyAsA, action: 'next' };
    case 3:
      return state.applied ? { label: m.cta.whatIfNot, action: 'next' } : { label: m.cta.apply, action: 'apply' };
    case 4:
      return { label: m.cta.toDraw, action: 'next' };
    case 5:
      return state.picked.length ? { label: m.cta.seeResult, action: 'next' } : { label: m.cta.draw(w.preset.capacity), action: 'draw' };
    default: {
      const selected = state.picked.includes(w.a.receiptFor(w.programId));
      if (state.claimed) return { label: m.cta.restart, action: 'restart' };
      return selected ? { label: m.cta.claim, action: 'claim' } : { label: m.cta.tryClaim, action: 'claim' };
    }
  }
}

async function act(action: string) {
  const w = state.world;
  if (!w || state.busy) return;
  state.busy = true;
  try {
    switch (action) {
      case 'next':
        state.step = Math.min(state.step + 1, m.steps.length - 1);
        state.notice = null;
        break;
      case 'back':
        state.step = Math.max(state.step - 1, 0);
        state.notice = null;
        break;
      case 'apply': {
        const out = await applyToProgram(w.a, w.view, w.programId);
        if (out.kind === 'applied') state.applied = out.receipt;
        break;
      }
      case 'apply-again':
        try {
          await w.a.apply(w.programId); // bypass the local duplicate check on purpose: let the circuit answer
        } catch (e) {
          state.notice = explainError(e);
        }
        break;
      case 'cheat-submit':
        try {
          await w.b.apply(w.programId); // skip the local eligibility check: let the circuit answer
        } catch (e) {
          state.notice = explainError(e);
        }
        break;
      case 'cheat-forge': {
        const forged = w.net.party({ ...w.b.party.state, credential: toContractCredential(cheatParts(w).forged) });
        try {
          await new SimulatedHolder(forged).apply(w.programId);
        } catch (e) {
          state.notice = explainError(e);
        }
        break;
      }
      case 'draw':
        state.picked = await drawAndSelect(w.operator, w.view, contractTicketHasher, w.programId);
        break;
      case 'claim': {
        const out = await claimBenefit(w.a, w.view, w.programId);
        if (out.kind === 'claimed') state.claimed = true;
        else {
          try {
            await w.a.claim(w.programId);
          } catch (e) {
            state.notice = { tone: 'no', title: m.claimRefused, body: esc((e as Error).message) };
          }
        }
        break;
      }
      case 'restart':
        await boot();
        return;
      case 'tab-public':
        state.inspector = 'public';
        break;
      case 'tab-private':
        state.inspector = 'private';
        break;
    }
  } finally {
    state.busy = false;
  }
  render();
}

// ---------------------------------------------------------------- render

function render() {
  const w = state.world;
  const app = $('#app');
  if (!w) {
    app.innerHTML = `<main class="layout"><section class="story"><div class="skeleton h1"></div><div class="skeleton card"></div><div class="skeleton card"></div></section></main>`;
    return;
  }
  const body = [stepIntro, stepIssue, stepProgram, stepApply, stepCheat, stepDraw, stepClaim][state.step]!(w);
  const c = cta();
  const other = lang === 'ko' ? 'en' : 'ko';
  app.innerHTML = `
    <header class="bar">
      <span class="brand">${m.brand}</span>
      <span class="badge">${m.badge}</span>
      <a class="lang-switch" href="${hrefWith('lang', other)}" lang="${other}" hreflang="${other}">${m.switchLangLabel}</a>
    </header>
    <nav class="progress" aria-label="${esc(m.progressLabel)}">
      ${m.steps.map((s, i) => `<span class="${i === state.step ? 'now' : i < state.step ? 'done' : ''}">${s}</span>`).join('')}
    </nav>
    <main class="layout">
      <section class="story" data-step="${state.step}">${body}
        ${state.step > 0 ? `<button class="text" data-action="back">${m.back}</button>` : ''}
      </section>
      <aside class="inspector" aria-label="${esc(m.inspectorLabel)}">
        <details class="inspector-toggle" ${window.innerWidth >= 960 ? 'open' : ''}>
          <summary>${m.inspectorLabel}</summary>
          ${inspector(w)}
        </details>
      </aside>
    </main>
    <footer class="cta"><button class="primary" data-action="${c.action}" ${c.disabled ? 'disabled' : ''}>${c.label}</button></footer>`;
}

async function boot() {
  state.world = undefined;
  state.step = 0;
  state.applied = undefined;
  state.notice = null;
  state.picked = [];
  state.claimed = false;
  render();
  state.world = await createWorld(presetId);
  render();
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (t) void act(t.dataset.action!);
});

void boot();
