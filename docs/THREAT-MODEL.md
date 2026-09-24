# Threat model — JustEnough

## Parties and trust
| Party | Holds | Trusted for |
|---|---|---|
| Issuer | issuer secret; the authoritative records (off-chain) | attesting attributes correctly; issuing **one** credential per person; keeping the salt only with the holder |
| Operator | operator secret for one programme | publishing the notice's rule faithfully; drawing fairly (the draw itself is public and auditable per receipt) |
| Applicant | 32-byte secret, credential, salt | nothing — every claim is checked by the circuit |
| Observer | the public ledger | nothing |

## What the circuit guarantees (tested)
| Attack | Stopped by | Test |
|---|---|---|
| Apply with attributes that were never issued | commitment not in the historic tree → `Credential was not issued by the issuer` | AC-5 |
| Change one attribute of a real credential (e.g. income) | same — the commitment changes | AC-5 tamper |
| Use someone else's issued commitment via their Merkle path | `path.leaf == commitment(own values, own holder key, salt)` → `Merkle path does not belong to this credential` | AC-6 |
| Apply twice | receipt = `hash(domain, programId, secret)` is deterministic → `Already applied to this program` | AC-4 |
| Apply while not meeting one predicate | `meetsPolicy` → `Credential does not meet the eligibility policy` | AC-7 (each predicate) |
| Non-issuer inserts commitments | `issuerKey(secret) == issuer` | AC-1 |
| Non-operator closes a programme or selects receipts | `operatorKey(secret) == program.operator` | AC-9 |
| Select before closing, over capacity, twice | status and counter checks | AC-9 |
| Claim someone else's selected receipt | receipt recomputed from the caller's own secret | AC-10 |
| Operator changes the draw seed after seeing the receipts | seed = `drawSeedFor(operatorSecret, programId)`, committed at `registerProgram` (no receipts exist yet); `closeProgram` reveals it and asserts `seedCommitmentOf(seed) == seedCommitment` | AC-16 |
| Operator selects favourites instead of the lowest tickets | not prevented in-circuit, but publicly detectable: `auditDraw` recomputes every ticket from the revealed seed | AC-16 (audit catches it) |

## What an observer learns
- That a credential was issued (a new leaf), and when.
- The programme rule (public by design).
- That *some* holder whose commitment was in the tree at the proven root applied, and when; the receipt is unlinkable to the holder key and to receipts in other programmes (`AC-8`).
- Counts of applicants and selections.
- **Not**: any attribute value (`AC-3` decodes every public atom and checks), which leaf was used, or who is behind a receipt.

## Residual risks and mitigations
| Risk | Why it remains | Mitigation |
|---|---|---|
| Timing correlation (issuance → application) | leaves and receipts are timestamped by blocks | issue credentials in batches (`npm run issue:batch` shuffles the public list so it does not follow the registrar's export order); the historic root lets applicants prove against an older root |
| Small anonymity set | a proof names the root it used; only leaves before it are candidates | tree depth 16 (65,536); applicants can use a root after a large batch |
| Issuer issues two credentials to one person (two secrets) | the contract cannot see real-world identity | issuer policy: one active credential per person; revocation epoch (roadmap) |
| Brute-forcing a commitment | attribute space is small (dates, codes) | 32-byte random salt known only to the holder |
| Witness code lies | witnesses are untrusted input to the circuit | every witness output is constrained: secret → keys, credential+salt → commitment → tree, path leaf equality |
| Operator ignores the draw and pays someone else | payment is off-chain | selection status is public per receipt; a claim needs the selected receipt's secret |
| Operator leaks the committed seed to a friend before the friend's credential is issued | the friend could try many secrets offline and pick one with a low ticket | issuer issues one credential per person; roadmap: mix a public randomness beacon into the seed at close |
| Programme-id squatting | `registerProgram` is first-come for a 32-byte id | blocking only (no data or funds at risk); the notice publishes its id; roadmap: operator-namespaced ids |
| Demo vs. network | the browser demo runs the compiled circuit logic without proofs or fees | on a Midnight network the same circuits are proven by the proof server; keys are produced by `npm run compile` |

## The demo's live leak scan ("What the chain sees")
After every call the browser demo decodes every atom of the public ledger state and of that call's public transcript and looks for the applicant's birth date, district, income and valid-until (`src/adapters/simulator/chain-view.ts`). The province and the yes/no flags are not scanned: the rule already makes them public for an eligible applicant, and 0, 1 and 11 occur in any ledger as counters and flags, so a scan for them would report false positives. The contract test AC-3 applies the same decoding to the transcript of `apply`.

## Disclosure inventory (`disclose()` in the contract)
| Where | Value | Why it is safe |
|---|---|---|
| constructor | `issuerKey(secret)` | a hash; identifies the issuer role only |
| `issueCredential` | commitment; key comparison result | salted hash; the comparison must be true for the call to exist |
| `registerProgram` | id, policy, capacity, `operatorKey(secret)` | public notice data; role key |
| `apply` | `path.leaf == commitment` (always true), Merkle root, `meetsPolicy(...)` (always true), receipt | constant booleans; the root is one of the public historic roots; receipt is a domain-separated hash |
| `registerProgram` | `seedCommitmentOf(drawSeedFor(secret, id))` | hash of a hash of the operator secret; binds the draw before any receipt exists |
| `closeProgram` | draw seed, commitment comparison (always true) | the seed is meant to be public from this point; revealing it does not reveal the operator secret |
| `selectApplicant` | ids, receipt, operator comparison (always true) | public identifiers |
| `claimBenefit` | receipt | already public since `apply` |
