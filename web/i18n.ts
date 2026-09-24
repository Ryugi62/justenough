// Every message the browser demo renders, in Korean and English (AC-18). Keys are shared by type, and
// tests/web/i18n.test.ts checks that English carries no Hangul. HTML is allowed in values; values that
// interpolate user-visible data receive already-escaped strings from main.ts.
import type { Lang } from '../src/domain/lang';
import type { Predicate } from '../src/domain/eligibility';
import type { PresetId } from '../src/domain/presets';

export type { Lang };

/** `?lang=` wins; otherwise Korean browsers get Korean and everyone else English. */
export function langFrom(search: string, navigatorLanguage: string | undefined): Lang {
  const m = /[?&]lang=([^&#]+)/.exec(search);
  if (m?.[1] === 'ko' || m?.[1] === 'en') return m[1];
  if (m) return 'en';
  if (!navigatorLanguage) return 'ko';
  return navigatorLanguage.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

type Circuit = 'issueCredential' | 'registerProgram' | 'apply' | 'closeProgram' | 'selectApplicant' | 'claimBenefit';

export interface Messages {
  htmlTitle: string;
  switchLangLabel: string;
  brand: string;
  badge: string;
  progressLabel: string;
  steps: readonly string[];
  back: string;
  pred: Record<Predicate, string>;
  mineTitle: string;
  errors: ReadonlyArray<readonly [RegExp, string, string]>;
  errorFallback: string;
  claimRefused: string;
  // credential card
  credLabels: { birth: string; place: string; student: string; employed: string; income: string; valid: string };
  credBirth: (date: string, age: number) => string;
  credPlace: (sido: string, district: string) => string;
  credStudent: (yes: boolean) => string;
  credEmployed: (yes: boolean) => string;
  credIncome: (pct: number) => string;
  credValid: (date: string) => string;
  // policy chips
  chipLivesIn: (place: string) => string;
  chipStudent: string;
  chipUnemployed: string;
  chipIncome: (pct: number) => string;
  // 0 · intro
  introEyebrow: string;
  introTitle: string;
  heroCaption: string;
  introProblem: Record<PresetId, string>;
  introHow: readonly [string, string, string];
  introWhatRunsSummary: string;
  introWhatRunsBody: string;
  // 1 · issue
  issueEyebrow: string;
  issueTitle: string;
  tagPrivate: string;
  tagPublic: string;
  oneHash: string;
  issuedSoFar: (n: number) => string;
  whyHashSummary: string;
  whyHashBody: string;
  // 2 · programme
  programEyebrow: string;
  programTitle: string;
  programLead: string;
  places: (n: number) => string;
  placesLabel: string;
  appliedSoFar: (n: number) => string;
  appliedSoFarLabel: string;
  realNoticesSummary: (n: number) => string;
  outsideCircuit: string;
  source: string;
  checkedOn: (date: string) => string;
  koreanOriginal: string;
  // 3 · apply
  applyEyebrow: string;
  applyTitleBefore: string;
  applyLead: string;
  applyTitleAfter: string;
  zeroCaptionAfter: string;
  myReceipt: string;
  applications: string;
  tryAgain: string;
  conditionsSummary: (n: number) => string;
  // 4 · cheat
  cheatEyebrow: (bValue: string) => string;
  cheatTitle: string;
  submitAnyway: string;
  forgeButton: (passingValue: string) => string;
  stillApplied: (n: number) => string;
  // 5 · draw
  drawEyebrow: string;
  drawTitle: string;
  drawLead: (n: number, cap: number) => string;
  picked: string;
  verifiableDraw: string;
  seedCommitted: string;
  seedRevealedAtClose: string;
  seedRevealed: string;
  auditLine: (ok: boolean, n: number) => string;
  seedFixedNote: string;
  formulaSummary: string;
  formulaBody: (cap: number) => string;
  // 6 · claim
  claimEyebrow: string;
  claimedTitle: string;
  metricDocs: string;
  metricDocsLabel: string;
  metricLedger: string;
  metricLedgerLabel: string;
  metricRejected: (n: number) => string;
  metricRejectedLabel: string;
  metricCalls: (n: number) => string;
  metricCallsLabel: string;
  payoutLead: (cap: number) => string;
  selectedTitle: (yes: boolean) => string;
  selectedLead: (yes: boolean) => string;
  statusSelected: (yes: boolean) => string;
  ledgerStatus: string;
  // real network card
  devnetTag: string;
  devnetBody: string;
  devnetPresetNote: string;
  devnetTxs: (n: number) => string;
  devnetTxsLabel: string;
  devnetSeconds: (s: string) => string;
  devnetApplyLabel: string;
  devnetRefused: (n: number) => string;
  devnetRefusedLabel: string;
  devnetLeaks: (n: number) => string;
  devnetLeaksLabel: string;
  devnetTxList: string;
  block: string;
  // inspector: what the chain sees
  inspectorLabel: string;
  tabPublic: string;
  tabPrivate: string;
  chainNothingYet: string;
  lastCall: (circuit: string, ops: number) => string;
  disclosed: string;
  disclosedBy: Record<Circuit, string>;
  scanOk: (atoms: number) => string;
  scanFail: (n: number) => string;
  scanWhat: string;
  receiptsHashes: (n: number) => string;
  rawTranscript: string;
  privateNote: string;
  privateInputs: string;
  // CTA
  cta: {
    start: string;
    seeRule: string;
    applyAsA: string;
    apply: string;
    whatIfNot: string;
    toDraw: string;
    draw: (cap: number) => string;
    seeResult: string;
    claim: string;
    tryClaim: string;
    restart: string;
  };
}

const ko: Messages = {
  htmlTitle: '딱 그만큼 · JustEnough — 등본 대신 자격만 증명',
  switchLangLabel: 'English',
  brand: '딱 그만큼 <small>JustEnough</small>',
  badge: '브라우저 안 Compact 회로 실행 · 지갑 없이',
  progressLabel: '진행',
  steps: ['시작', '발급', '공고', '신청', '거짓 신청', '추첨', '수령'],
  back: '이전',
  pred: { age: '나이', province: '거주 시도', district: '거주 시군구', student: '재학', unemployed: '취업 상태', income: '가구 소득', validity: '증명 유효기간' },
  mineTitle: '내 기기에서만 보여요',
  errors: [
    [/Credential does not meet the eligibility policy/, '증명을 만들 수 없어요', '조건을 충족하지 않는 값으로는 회로가 증명을 만들지 않아요. 원장에는 아무것도 남지 않았어요.'],
    [/Credential was not issued by the issuer/, '발급된 적 없는 증명이에요', '값을 하나라도 바꾸면 해시가 달라져서 발급기관의 트리에서 찾을 수 없어요.'],
    [/Already applied to this program/, '이미 신청했어요', '같은 사람·같은 공고는 항상 같은 영수증이 나와요. 두 번째 제출은 회로가 거절해요.'],
  ],
  errorFallback: '회로가 거절했어요',
  claimRefused: '수령 증명이 거절됐어요',
  credLabels: { birth: '생년월일', place: '거주지', student: '재학', employed: '취업', income: '가구 소득', valid: '유효기간' },
  credBirth: (date, age) => `${date} (만 ${age}세)`,
  credPlace: (sido, district) => `${sido} · ${district}`,
  credStudent: (yes) => (yes ? '재학 중' : '재학 아님'),
  credEmployed: (yes) => (yes ? '취업 중' : '미취업'),
  credIncome: (pct) => `기준 중위소득 ${pct}%`,
  credValid: (date) => `${date}까지`,
  chipLivesIn: (place) => `${place} 거주`,
  chipStudent: '재학생',
  chipUnemployed: '미취업',
  chipIncome: (pct) => `중위소득 ${pct}% 이하`,
  introEyebrow: 'Midnight Korea Hackathon 2026 · Privacy DApp',
  introTitle: '등본 대신,<br/>자격만 증명해요',
  heroCaption: '기관에 넘어가는 개인정보 항목',
  introProblem: {
    youth: '지금은 청년 지원금 하나 신청하려 해도 주민등록등본·재학증명서·소득 서류를 내요. 서류 한 장에 필요 이상의 정보가 함께 넘어가요.',
    grant: '지금 그랜트·에어드롭은 둘 중 하나예요. 신분증을 모으거나(KYC), 한 사람이 지갑 여러 개로 여러 번 받아 가는 걸 뒤늦게 추적하거나.',
  },
  introHow: [
    '<b>발급기관</b>은 자격 증명의 해시 1개만 원장에 올려요',
    '<b>지원자</b>는 “조건을 충족한다”는 사실만 영지식 증명으로 내요',
    '<b>운영기관</b>은 누가 신청했는지 모른 채 영수증으로 추첨해요',
  ],
  introWhatRunsSummary: '이 화면에서 실제로 무엇이 돌아가나요?',
  introWhatRunsBody:
    '이 페이지는 <code>justenough.compact</code>를 컴파일한 회로 코드를 브라우저 안에서 그대로 실행해요(@midnight-ntwrk/compact-runtime). 지갑 설치 없이 확인할 수 있게 원장은 브라우저 안의 시뮬레이터예요. 여기서는 같은 회로 로직만 실행하고 영지식 증명은 만들지 않아요. 실제 네트워크에서는 같은 회로의 증명을 proof server가 만들어요 — 마지막 화면에 그 실행 기록이 있어요.',
  issueEyebrow: '1 · 발급기관 Issuer',
  issueTitle: '지원자 A의 자격 증명이 발급됐어요',
  tagPrivate: '내 지갑에만 · Private state',
  tagPublic: '공개 원장 · Public ledger',
  oneHash: '해시 1개',
  issuedSoFar: (n) => `발급된 증명은 모두 ${n}개. 값이 아니라 해시만 머클 트리에 쌓여요.`,
  whyHashSummary: '해시만 올려도 되는 이유',
  whyHashBody:
    '해시는 <code>credentialCommitment(증명 값, 지원자 키, 무작위 salt)</code>예요. salt를 모르면 “만 27세·관악구”를 넣어 맞혀 보는 식으로도 되돌릴 수 없어요. 지원자는 나중에 이 해시가 트리에 있다는 것만 증명해요(어느 잎인지는 숨김).',
  programEyebrow: '2 · 운영기관 Operator',
  programTitle: '공고 조건은 원래 공개돼 있어요',
  programLead: '그래서 조건은 그대로 원장에 올려요. 숨길 건 지원자의 값이에요.',
  places: (n) => `${n}명`,
  placesLabel: '선정 정원',
  appliedSoFar: (n) => `${n}명`,
  appliedSoFarLabel: '지금까지 신청',
  realNoticesSummary: (n) => `실제 공고 ${n}건은 이렇게 회로 조건이 돼요`,
  outsideCircuit: '회로 밖',
  source: '원문',
  checkedOn: (date) => `${date} 확인`,
  koreanOriginal: '원문',
  applyEyebrow: '3 · 지원자 A Applicant',
  applyTitleBefore: '제출하는 건 증명 1개예요',
  applyLead: '🔒 표시 값은 이 기기에서만 보여요. 회로 안에서만 쓰이고 원장에는 안 올라가요.',
  applyTitleAfter: '신청됐어요',
  zeroCaptionAfter: '기관에 넘어간 개인정보 항목',
  myReceipt: '내 신청 영수증',
  applications: '전체 신청',
  tryAgain: '같은 공고에 한 번 더 내 보기',
  conditionsSummary: (n) => `증명에 쓰인 조건 ${n}개`,
  cheatEyebrow: (bValue) => `4 · 지원자 B (${bValue})`,
  cheatTitle: '조건이 안 되면 증명이 만들어지지 않아요',
  submitAnyway: '그래도 제출해 보기',
  forgeButton: (v) => `“${v}”으로 값 바꿔 내 보기`,
  stillApplied: (n) => `전체 신청은 그대로 ${n}명이에요.`,
  drawEyebrow: '5 · 운영기관 Operator',
  drawTitle: '기관은 영수증만 보고 추첨해요',
  drawLead: (n, cap) => `신청 ${n}건 · 정원 ${cap}명. 누가 누구인지는 기관도 몰라요.`,
  picked: '선정',
  verifiableDraw: '검증 가능한 추첨',
  seedCommitted: '공고 등록 때 약속한 시드 해시',
  seedRevealedAtClose: '마감 때 공개',
  seedRevealed: '공개된 추첨 시드',
  auditLine: (ok, n) => `${ok ? '✓' : '✕'} 공개 시드로 누구나 다시 계산한 결과 = 선정된 ${n}건 ${ok ? '일치' : '불일치'}`,
  seedFixedNote: '시드는 신청이 하나도 없을 때 정해져서, 기관이 결과를 보고 고를 수 없어요.',
  formulaSummary: '계산식',
  formulaBody: (cap) =>
    `<code>ticket = hash(seed, 영수증)</code> 값이 가장 작은 ${cap}건이 선정돼요. 시드는 <code>hash(공고 id, 기관 비밀키)</code>로 공고 등록 순간에 고정되고, 그 해시만 먼저 원장에 올라가요.`,
  claimEyebrow: '6 · 지원자 A',
  claimedTitle: '수령까지 끝났어요',
  metricDocs: '0장',
  metricDocsLabel: '기관이 받은 서류',
  metricLedger: '0건',
  metricLedgerLabel: '원장에 남은 개인정보',
  metricRejected: (n) => `${n}명`,
  metricRejectedLabel: '탈락자 — 보관할 서류 자체가 없어요',
  metricCalls: (n) => `${n}건`,
  metricCallsLabel: '이 데모에서 실행한 회로 호출',
  payoutLead: (cap) => `지급 단계에서만 선정자가 기관에 직접 연락처를 알려요. 원장 밖, 선정된 ${cap}명만요.`,
  selectedTitle: (yes) => (yes ? '선정됐어요' : '이번엔 선정되지 않았어요'),
  selectedLead: (yes) =>
    yes ? '이제 선정된 영수증이 내 것이라는 사실만 증명하면 돼요.' : '기관은 A가 떨어졌다는 사실조차 몰라요. 선정되지 않은 영수증으로는 수령 증명이 안 돼요.',
  statusSelected: (yes) => (yes ? '선정' : '미선정'),
  ledgerStatus: '원장 상태',
  devnetTag: '실제 Midnight 네트워크 실행 기록',
  devnetBody:
    '같은 컨트랙트·같은 witness를 로컬 Midnight 네트워크(node·indexer·proof server)에 배포해 실제 ZK 증명으로 실행했어요. <code>npm run devnet:e2e</code>',
  devnetPresetNote: '(기록은 청년 구직 활동 지원금 공고로 실행한 것)',
  devnetTxs: (n) => `${n}건`,
  devnetTxsLabel: '확정된 트랜잭션 (배포→수령)',
  devnetSeconds: (s) => `${s}초`,
  devnetApplyLabel: '신청 증명 생성+제출',
  devnetRefused: (n) => `${n}건`,
  devnetRefusedLabel: '회로가 거절한 시도 (B·중복)',
  devnetLeaks: (n) => `${n}건`,
  devnetLeaksLabel: '인덱서 공개 상태의 속성 값',
  devnetTxList: '트랜잭션 목록',
  block: '블록',
  inspectorLabel: '체인이 보는 것 · Ledger inspector',
  tabPublic: '체인이 보는 것 · 누구나',
  tabPrivate: 'A의 기기 · A만',
  chainNothingYet: '아직 이번 화면에서 실행한 호출이 없어요.',
  lastCall: (circuit, ops) => `마지막 호출 <code>${circuit}</code> · 공개 연산 ${ops}개`,
  disclosed: '이 호출이 체인에 공개한 것',
  disclosedBy: {
    issueCredential: '증명 해시 1개 (값 없음)',
    registerProgram: '공고 id · 자격 요건 · 운영기관 키 · 추첨 시드 해시',
    apply: '신청 영수증 1개 · 신청 수 +1',
    closeProgram: '마감 상태 · 추첨 시드',
    selectApplicant: '영수증 상태 → 선정 · 선정 수 +1',
    claimBenefit: '영수증 상태 → 수령',
  },
  scanOk: (atoms) => `✓ 공개 값 ${atoms}개를 방금 다시 훑었어요. A의 비공개 값은 0개.`,
  scanFail: (n) => `✕ A의 비공개 값 ${n}개가 공개 값에서 발견됐어요`,
  scanWhat: '찾은 값: 생년월일·시군구·소득·유효기간 (원장 상태 + 이 호출의 공개 기록)',
  receiptsHashes: (n) => `영수증 ${n}개 (해시)`,
  rawTranscript: '원장에 기록된 연산 원문 (public transcript)',
  privateNote: 'A의 기기 밖으로 나가지 않아요. 회로 안에서 계산에만 쓰여요.',
  privateInputs: 'A가 회로에 넣은 값 (private inputs)',
  cta: {
    start: '지원자 A로 시작하기',
    seeRule: '공고 보기',
    applyAsA: '지원자 A로 신청하기',
    apply: '신청하기',
    whatIfNot: '조건이 안 되는 사람은?',
    toDraw: '마감하고 추첨하러 가기',
    draw: (cap) => `마감하고 시드 공개 · ${cap}명 추첨`,
    seeResult: '지원자 A의 결과 보기',
    claim: '수령하기',
    tryClaim: '수령 증명 시도해 보기',
    restart: '처음부터 다시 보기',
  },
};

const en: Messages = {
  htmlTitle: 'JustEnough — prove you qualify, not who you are',
  switchLangLabel: '한국어',
  brand: 'JustEnough <small lang="ko">딱 그만큼</small>',
  badge: 'Compact circuits running in your browser · no wallet',
  progressLabel: 'Progress',
  steps: ['Start', 'Issue', 'Rule', 'Apply', 'Cheat', 'Draw', 'Claim'],
  back: 'Back',
  pred: { age: 'Age', province: 'Province', district: 'District', student: 'Student', unemployed: 'Employment', income: 'Household income', validity: 'Credential validity' },
  mineTitle: 'Visible only on this device',
  errors: [
    [/Credential does not meet the eligibility policy/, 'No proof can be made', 'The circuit will not accept values that fail the rule. Nothing was written to the ledger.'],
    [/Credential was not issued by the issuer/, 'This credential was never issued', "Change any value and the hash changes, so it is not in the issuer's tree."],
    [/Already applied to this program/, 'Already applied', 'The same person always gets the same receipt for the same programme, so the circuit refuses a second one.'],
  ],
  errorFallback: 'The circuit refused',
  claimRefused: 'Claim refused',
  credLabels: { birth: 'Date of birth', place: 'Residence', student: 'Student', employed: 'Employment', income: 'Household income', valid: 'Valid until' },
  credBirth: (date, age) => `${date} (age ${age})`,
  credPlace: (_sido, district) => `${district}`,
  credStudent: (yes) => (yes ? 'Enrolled' : 'Not enrolled'),
  credEmployed: (yes) => (yes ? 'Employed' : 'Not employed'),
  credIncome: (pct) => `${pct}% of median income`,
  credValid: (date) => `${date}`,
  chipLivesIn: (place) => `Lives in ${place}`,
  chipStudent: 'Enrolled student',
  chipUnemployed: 'Not employed',
  chipIncome: (pct) => `Income ≤ ${pct}% of median`,
  introEyebrow: 'Privacy DApp on Midnight · zero-knowledge eligibility',
  introTitle: 'Prove you qualify,<br/>not who you are',
  heroCaption: 'personal fields the institution receives',
  introProblem: {
    youth: 'To apply for a Korean youth allowance today you upload a resident-registration copy, an enrolment certificate and income papers. Each document carries far more than the three yes/no answers the institution needs.',
    grant: 'Grants and airdrops face two bad options today: collect ID documents (KYC), or chase people who claim many times with many wallets after the fact.',
  },
  introHow: [
    'The <b>issuer</b> puts one hash of your credential on the ledger',
    'The <b>applicant</b> proves “I meet the rule” in zero knowledge',
    'The <b>operator</b> draws anonymous receipts without knowing who applied',
  ],
  introWhatRunsSummary: 'What actually runs on this page?',
  introWhatRunsBody:
    'This page runs the circuits compiled from <code>justenough.compact</code> in your browser (@midnight-ntwrk/compact-runtime). So that you can try it without a wallet, the ledger is an in-browser simulator: it executes the same circuit logic but does not generate zero-knowledge proofs. On a Midnight network the proof server proves the same circuits — the last screen shows that run.',
  issueEyebrow: '1 · Issuer',
  issueTitle: "Applicant A's credential is issued",
  tagPrivate: "Only in A's wallet · private state",
  tagPublic: 'Public ledger',
  oneHash: 'One hash',
  issuedSoFar: (n) => `${n} credentials issued so far. Only hashes go into the Merkle tree, never the values.`,
  whyHashSummary: 'Why one hash is enough',
  whyHashBody:
    'The hash is <code>credentialCommitment(values, holder key, random salt)</code>. Without the salt nobody can reverse it by guessing “age 27, Gwanak-gu”. Later the applicant proves only that this hash is in the tree, not which leaf it is.',
  programEyebrow: '2 · Operator',
  programTitle: 'The rule is public anyway',
  programLead: "So the rule goes on the ledger as is. What needs hiding is the applicant's data.",
  places: (n) => `${n}`,
  placesLabel: 'places',
  appliedSoFar: (n) => `${n}`,
  appliedSoFarLabel: 'applied so far',
  realNoticesSummary: (n) => `${n} real Korean notices, translated into circuit rules`,
  outsideCircuit: 'Outside the circuit',
  source: 'source',
  checkedOn: (date) => `checked ${date}`,
  koreanOriginal: 'Korean original',
  applyEyebrow: '3 · Applicant A',
  applyTitleBefore: 'You submit one proof, nothing else',
  applyLead: 'Your values (right-hand column) are visible only on this device. They are used inside the circuit and never reach the ledger.',
  applyTitleAfter: 'Applied',
  zeroCaptionAfter: 'personal fields the institution received',
  myReceipt: 'my receipt',
  applications: 'applications',
  tryAgain: 'Try applying again',
  conditionsSummary: (n) => `${n} conditions checked inside the circuit`,
  cheatEyebrow: (bValue) => `4 · Applicant B (${bValue})`,
  cheatTitle: "If you don't qualify, no proof can be made",
  submitAnyway: 'Submit anyway',
  forgeButton: (v) => `Change it to “${v}” and submit`,
  stillApplied: (n) => `Applications: still ${n}.`,
  drawEyebrow: '5 · Operator',
  drawTitle: 'The operator draws receipts, not people',
  drawLead: (n, cap) => `${n} applications · ${cap} places. The operator cannot tell who is who.`,
  picked: 'selected',
  verifiableDraw: 'Verifiable draw',
  seedCommitted: 'seed hash committed at registration',
  seedRevealedAtClose: 'revealed at close',
  seedRevealed: 'revealed draw seed',
  auditLine: (ok, n) => `${ok ? '✓' : '✕'} Anyone can recompute it from the public seed: ${n} selected, ${ok ? 'match' : 'mismatch'}`,
  seedFixedNote: 'The seed was fixed before any application existed, so the operator cannot pick winners after seeing who applied.',
  formulaSummary: 'Formula',
  formulaBody: (cap) =>
    `The ${cap} lowest values of <code>ticket = hash(seed, receipt)</code> win. The seed is <code>hash(programme id, operator secret)</code>, fixed at registration; only its hash goes on the ledger first.`,
  claimEyebrow: '6 · Applicant A',
  claimedTitle: 'Claimed',
  metricDocs: '0',
  metricDocsLabel: 'documents the institution received',
  metricLedger: '0',
  metricLedgerLabel: 'personal values on the ledger',
  metricRejected: (n) => `${n}`,
  metricRejectedLabel: 'not selected — no documents to store',
  metricCalls: (n) => `${n}`,
  metricCallsLabel: 'circuit calls in this demo',
  payoutLead: (cap) => `Only at payout do the ${cap} selected people contact the institution — off-chain.`,
  selectedTitle: (yes) => (yes ? 'You were selected' : 'Not selected this time'),
  selectedLead: (yes) =>
    yes ? 'Now A proves only that the selected receipt is theirs.' : 'The operator does not even know that A lost. A receipt that was not selected cannot be claimed.',
  statusSelected: (yes) => (yes ? 'selected' : 'not selected'),
  ledgerStatus: 'ledger status',
  devnetTag: 'Real Midnight network run',
  devnetBody:
    'The same contract and witnesses, deployed to a local Midnight network (node · indexer · proof server) and run with real zero-knowledge proofs. <code>npm run devnet:e2e</code>',
  devnetPresetNote: '(recorded with the youth-allowance programme)',
  devnetTxs: (n) => `${n}`,
  devnetTxsLabel: 'confirmed transactions (deploy → claim)',
  devnetSeconds: (s) => `${s} s`,
  devnetApplyLabel: 'apply: prove + submit',
  devnetRefused: (n) => `${n}`,
  devnetRefusedLabel: 'attempts refused by the circuit (B, duplicate)',
  devnetLeaks: (n) => `${n}`,
  devnetLeaksLabel: "attribute values in the indexer's public state",
  devnetTxList: 'Transactions',
  block: 'block',
  inspectorLabel: 'What the chain sees · ledger inspector',
  tabPublic: 'What the chain sees',
  tabPrivate: "A's device only",
  chainNothingYet: 'No call has run on this screen yet.',
  lastCall: (circuit, ops) => `Last call <code>${circuit}</code> · ${ops} public operations`,
  disclosed: 'What this call disclosed to the chain',
  disclosedBy: {
    issueCredential: 'one credential hash (no values)',
    registerProgram: 'programme id · eligibility rule · operator key · draw-seed hash',
    apply: 'one receipt (nullifier) · applicant count +1',
    closeProgram: 'status closed · draw seed',
    selectApplicant: 'receipt status → selected · selected count +1',
    claimBenefit: 'receipt status → claimed',
  },
  scanOk: (atoms) => `✓ Just re-scanned ${atoms} public values: 0 of A's private values found.`,
  scanFail: (n) => `✕ ${n} of A's private values found in public data`,
  scanWhat: "Looked for: birth date, district, income, valid-until (ledger state + this call's public transcript)",
  receiptsHashes: (n) => `${n} receipts (hashes)`,
  rawTranscript: 'Raw public transcript of this call',
  privateNote: "Never leaves A's device. Used only inside the circuit.",
  privateInputs: 'What A fed into the circuit (private inputs)',
  cta: {
    start: 'Start as applicant A',
    seeRule: 'See the programme rule',
    applyAsA: 'Apply as applicant A',
    apply: 'Apply',
    whatIfNot: "What if someone doesn't qualify?",
    toDraw: 'Close and go to the draw',
    draw: (cap) => `Close, reveal seed · draw ${cap}`,
    seeResult: "See applicant A's result",
    claim: 'Claim',
    tryClaim: 'Try to claim anyway',
    restart: 'Start over',
  },
};

export const MESSAGES: Readonly<Record<Lang, Messages>> = { ko, en };
