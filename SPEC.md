# JustEnough (딱 그만큼) — SPEC v0.4 (2026-09-24)

## 0. One line
A Midnight DApp for public benefit applications: the applicant proves **"I meet this program's eligibility rule"** instead of handing over a resident-registration copy, enrolment certificate and income papers. The essence is **not a ZK demo (A) but an application where no original document changes hands (B).**

## 1. Success conditions · deadline · non-goals
- Reference: Midnight's own `example-zkloan` (issuer-attested score → loan tier) proves the attestation pattern works; `midnight-verifiable-credentials` / `passport-demo` show the Foundation is investing in credentials. Neither covers **policy-driven public applications with anonymous selection** — that gap is this project.
- Success (numbers):
  - 1 Compact contract compiles on **compactc 0.31.1 and 0.34.0** (CI matrix), 6 provable circuits.
  - **≥ 80 automated tests** green (85 at v0.3): circuit behaviour (simulator), domain rules, a differential test where the TS domain rule and the compiled `meetsPolicy` circuit agree on **≥ 1,000** random cases, architecture rules, and README ↔ submission text parity.
  - Public ledger after an application holds **0 attribute values** (asserted by test: no credential field value appears in the ledger dump).
  - Demo runs in a browser **without a wallet** (in-browser contract execution) and in **≤ 5 minutes** from `git clone` (measured 2026-09-24 on v0.4: 32.5 s and 38.7 s for `npm ci && npm run verify` in a fresh clone, warm npm cache, laptop under other load).
  - The same lifecycle runs on a **real Midnight network** with proofs from the proof server (local devnet: 8 transactions recorded in `docs/devnet-run.json`).
- Deadline: submission closes 2026-09-28 00:00 KST (rules art. 3). Internal freeze 2026-09-27 12:00 KST.
- Non-goals: a production issuer integration (the issuer is a role account in the demo); revocation lists; mobile wallet; payments of the benefit itself; OR-combined clauses (one policy = AND of predicates; an OR clause is registered as two programs).

## 2. Constraints
- Rules art. 5 ①: net-new since 2026-09-01, Apache-2.0. Art. 7 ③: not a fork or clone. Art. 7 ②: a contract that does not compile disqualifies. Art. 10 ① 4: no personal identifying data — **every persona in the repo is synthetic.**
- Privacy: no attribute value may be disclosed to the ledger. Only commitments, nullifiers, counters and the (already public) policy are disclosed.
- Cost: 0 KRW (no paid services).

## 3. Ubiquitous language (code names are 1:1)
| Term | Meaning | Code |
|---|---|---|
| Issuer (발급기관) | Authority that already holds the records and attests to them | `issuer`, `issuerKey`, `issueCredential` |
| Credential (자격 증명) | Attested attributes: birth date, province, district, student, employed, income %, valid-until | `Credential` |
| Credential commitment | Salted hash of a credential bound to a holder key; the only thing the issuer publishes | `credentialCommitment` |
| Credential tree | Public historic Merkle tree of commitments | `credentials` |
| Holder / Applicant (지원자) | Person holding the credential in private state | `holderKey`, `localSecret`, `heldCredential` |
| Program (공고) | A benefit programme with a policy, operator, capacity and status | `Program`, `registerProgram` |
| Eligibility policy (자격 요건) | AND of predicates translated from the notice text | `EligibilityPolicy`, `meetsPolicy` |
| Notice clause (공고 조항) | Verbatim eligibility sentence from a real notice | `NoticeClause` |
| Receipt / nullifier (신청 영수증) | `hash(domain, programId, secret)`: one per holder per program, unlinkable across programs | `nullifierFor`, `apply` |
| Operator (운영기관) | Institution running the programme | `operatorKey`, `closeProgram`, `selectApplicant` |
| Draw (추첨) | Operator selects receipts without knowing who is behind them | `selectApplicant` |
| Claim (수령) | Holder proves a selected receipt is theirs | `claimBenefit` |
| Demo preset (시나리오) | A programme plus its two synthetic applicants (A eligible, B not) that the browser demo runs | `DemoPreset`, `DEMO_PRESETS`, `?preset=` |
| Chain view (체인이 보는 것) | What an observer of the chain learned from one call, with a live scan for private values | `chainView`, `ChainView` |
| Locale | Language of every rendered message (`ko` default for Korean browsers, `en` otherwise) | `Lang`, `langFrom`, `MESSAGES` |

## 4. Model
- Value objects: `YMD` (YYYYMMDD date), `AgeBand` (만 나이 min/max), `RegionCode` (시도 2-digit, 시군구 5-digit).
- Entities: `Program` (aggregate root: policy, status, capacity, receipts).
- Domain services: `birthRangeFor(referenceDate, band)`, `explainEligibility(credential, policy)`, `policyFromClause(clause)`.
- Ports: `EligibilityLedger` (the contract as seen by the application), `CommitmentHasher` (the contract's own `credentialCommitment`, used by UC-7), `RandomSource`.

## 5. Use cases
| UC | Actor | Input | Output | Rule |
|---|---|---|---|---|
| UC-1 issue | Issuer | holder key, credential, salt | commitment on ledger | only the issuer key may insert |
| UC-2 register | Operator | notice clause, capacity | program on ledger | id unique, age band non-empty, capacity > 0 |
| UC-3 apply | Holder | program id | receipt on ledger | credential in tree ∧ policy met ∧ first time ∧ program open |
| UC-4 close | Operator | program id | status closed | operator only |
| UC-5 draw | Operator | program id | lowest-ticket receipts selected | operator only, closed (seed revealed), ≤ capacity; `auditDraw` lets anyone re-check |
| UC-6 claim | Holder | program id | receipt claimed | own receipt, selected |
| UC-7 issue batch | Issuer | registrar CSV export | shuffled public commitments + one private bundle per holder | every row valid or rejected with its line number; no attribute value in the public output |

## 6. Acceptance criteria (each → ≥ 1 test)
- AC-1 Given a deployed contract, When a non-issuer calls `issueCredential`, Then it fails with "Only the issuer can issue credentials".
- AC-2 Given an issued credential that meets the policy, When the holder applies, Then the receipt appears in `applications[program]` and `applicantCount` is 1.
- AC-3 Given the ledger after AC-2, Then no credential field value (birth date, district, income %) appears in the serialized public state.
- AC-4 Given a holder who already applied, When they apply again, Then it fails with "Already applied to this program".
- AC-5 Given a credential that is NOT in the tree (never issued / tampered attributes), When the holder applies, Then it fails with "Credential was not issued by the issuer".
- AC-6 Given a witness that returns another holder's Merkle path, Then it fails with "Merkle path does not belong to this credential".
- AC-7 Given a credential failing any single predicate (age, province, district, student, unemployed, income, expiry), Then apply fails with "Credential does not meet the eligibility policy".
- AC-8 Given the same holder, Then receipts for two programs differ (unlinkable), and differ from `holderKey`.
- AC-9 Given an open program, When the operator selects, Then it fails with "Close the program before selecting"; non-operators cannot close or select; selection stops at capacity.
- AC-10 Given a selected receipt, When its holder claims, Then status is `claimed`; a non-selected holder's claim fails.
- AC-11 `birthRangeFor` implements 만 나이 exactly (birthday on the reference date counts), including 29 Feb.
- AC-12 Differential: for ≥ 1,000 random (credential, policy) pairs, the TS `explainEligibility(...).eligible` equals the compiled `meetsPolicy`.
- AC-13 Architecture: `src/domain` imports nothing from application/adapters/web or any `@midnight-ntwrk` package; `src/application` imports no adapter.
- AC-14 README "One-line description" and "How Midnight is used" are byte-identical to `docs/SUBMISSION.md`.
- AC-15 Every notice clause in `src/domain/notices.ts` carries a source id and verbatim quote; the policy derived from it has the stated predicates.
- AC-16 Given a registered programme, Then only `seedCommitmentOf(drawSeedFor(operatorSecret, id))` is public; When it closes, Then the revealed seed matches the commitment, the selection equals the `capacity` lowest `drawTicket(seed, receipt)` values, and `auditDraw` flags any other selection.
- AC-17 The recorded devnet run shows 8 confirmed transactions (deploy → claim), both refusals (ineligible, duplicate), a matching seed commitment and 0 attribute values in the indexer's public state.
- AC-18 (English UI) Given `?lang=en` (or no `lang` and a non-Korean browser), Then every message the demo renders comes from the English catalogue: the Korean and English catalogues have the same keys (type-checked) and no English message contains Hangul; walking all 7 steps headless with `?lang=en` finds **0 Hangul characters** outside elements marked `lang="ko"` (verbatim Korean notice quotes and the Korean brand name, each shown with an English gloss). `?lang=ko` always wins.
- AC-19 (What the chain sees) Given any circuit call in the demo, Then the panel names the call, counts its public operations, lists what it disclosed, and shows a live scan of the public state plus that call's transcript for the applicant's private attribute values: **0 found**. Positive control: scanning for a value the policy does publish (its income cap) finds it, so the scanner is not blind.
- AC-20 (Web3 community grant preset) Given `?preset=grant`, Then the demo registers the synthetic "Web3 community grant" (age 19–34 ∧ Seoul ∧ enrolled student, one grant per person); its applicant A is accepted, applicant B fails exactly one predicate (student) and is refused by the circuit, B's forged credential (student flipped) is refused as not issued, and A's second application is refused as a duplicate. The default preset stays the Korean youth allowance.
- AC-21 (README first screen) The README, before its first `##` heading, carries: the tagline (identical to `docs/SUBMISSION.md` "Tagline"), the live demo link, a 3-line quick start, the test count, the CI badge, the line `Hackathon entries: Midnight Korea Hackathon 2026, 3rd-Web-Hack` and Apache-2.0; `scripts/check-test-count.mjs` (run in CI) fails if the stated test count differs from the number vitest actually ran.
- AC-22 (Decks) `docs/deck/JustEnough-deck.pdf` (Midnight, 16:9) and `docs/3rd-web-hack-deck.pdf` (3rd-Web-Hack, 3:2, 7 slides) are committed and every number they print about the build equals the repository's own evidence.
- AC-23 (Registrar batch issuance, first-pilot path) Given a registrar CSV export (`holder_ref,birth_date,sido,sigungu,student,employed,income_pct,valid_until`), When `issueBatch` runs, Then it returns one public commitment per valid row in shuffled order (the only file to publish) and one private bundle per holder (credential, 32-byte secret, salt); invalid rows are rejected with their line number and nothing is issued for them; the public output contains no `holder_ref` and no attribute value; a bundle, once its commitment is issued, applies successfully on the compiled contract; 1,000 rows take < 5 s.

## 7. Architecture (dependencies point inward)
```
src/domain ← src/application ← src/adapters (simulator, midnight contract) ← web/ (composition root, UI)
contract/src/justenough.compact → contract/src/managed (generated) ← src/adapters
```

## 8. Non-functional
- `npm run verify` = compile (0.31.1) → typecheck → test → web build, one command.
- In-browser demo: first interaction ≤ 1 s after load on a laptop; no external fonts/CDNs.

## 9. Physical verification
- Fresh clone in a new directory → `npm ci && npm run verify` green (recorded in the submission notes).
- Headless browser run of the full demo flow (issue → register → apply → reject → draw → claim) with screenshots at 390 px and 1280 px.

## UI acceptance (Toss checklist, concretised)
1. 390 px: no horizontal scroll. 2. One question per step, progress shown. 3. Titles ≥ 22 px bold, body 15–16 px. 4. Section gap ≥ 24 px, card radius ≥ 16 px. 5. One primary CTA fixed at the bottom, ≥ 52 px. 6. Result card leads with a number ("0 personal fields shared"). 7. Clause text and formulas inside closed `<details>`. 8. Short, friendly Korean copy, one-line gloss for ZK terms. 9. White background, one blue (#3182F6), ok/warn/no colours, contrast ≥ 4.5:1. 10. No external font/CDN.

## 10. Change log
- v0.1 2026-09-24 first draft (contract spike compiled on 0.31.1 to validate the language surface before the tests).
- v0.2 2026-09-24 AC-1..15, layer layout, UI acceptance.
- v0.3 2026-09-24 mock review → AC-16 auditable draw (seed committed at registration, revealed at close), AC-17 real-network evidence, devnet CI.
- v0.4 2026-09-24 shared build contract with the 3rd-Web-Hack entry (R1–R10) → AC-18 English UI, AC-19 "What the chain sees" panel with a live leak scan, AC-20 Web3 community grant preset, AC-21 README first screen + test-count check, AC-22 decks in the repo, AC-23 registrar batch issuance (BizDev: the first pilot's issuer path as one command).
