# Submission form text (single source)

Each section below is pasted into the hackathon submission form as-is. `tests/docs/submission-parity.test.ts`
fails if the README drifts from this file (the judges check that the form matches the README).

## Project name

JustEnough (딱 그만큼)

## One-line description

Apply for a public youth programme by proving in zero knowledge that you meet its eligibility rule (age band, residence, employment, income) — the institution receives no document and no personal value, only an anonymous receipt it can draw by lottery.

## How Midnight is used


- **Dual ledger, split on purpose.** Public ledger: the issuer key, a `HistoricMerkleTree<16, Bytes<32>>` of salted credential commitments, each programme's eligibility policy (public, like the notice it comes from), anonymous receipts and counters. Private state on the applicant's device: a 32-byte secret, the credential (birth date, province, district, student, employed, income %, valid-until) and its salt, fed to circuits through witnesses.
- **`apply` circuit.** Recomputes the credential commitment from private inputs, checks that the Merkle path leaf equals it, proves membership against a historic root (`merkleTreePathRoot` + `checkRoot`), evaluates the policy (`meetsPolicy`), and discloses only a receipt `persistentHash(domain, programId, secret)` — one application per person per programme, unlinkable across programmes.
- **Anonymous, auditable draw.** `registerProgram` commits to a draw seed derived in-circuit from the operator's secret and the programme id — before any receipt exists; `closeProgram` reveals it and the contract checks it against the commitment. The winners must be the `capacity` lowest `drawTicket(seed, receipt)` values, which anyone can recompute from the public ledger. Only a selected holder can prove a receipt is theirs (`claimBenefit`); the operator never learns who is behind a receipt.
- **Keys without `ownPublicKey()`.** Issuer, operator and holder keys are domain-separated `persistentHash` values of one witness secret, so one fee-paying wallet can act for any role and roles are proven, not claimed.
- **Checked, not claimed.** A test decodes every atom of the public transcript and ledger state after an application and asserts that no attribute value appears; a differential test checks the TypeScript rule against the compiled `meetsPolicy` circuit on 2,000 random cases; the full lifecycle also ran on a local Midnight network with real proofs from the proof server (8 transactions, `docs/devnet-run.json`), and a CI workflow repeats it on every push.

## How to run


```bash
# Node >= 22 and the Compact devtools (https://docs.midnight.network) are required
compact update 0.31.1                  # the compiler version the Midnight network supports
git clone https://github.com/Ryugi62/justenough && cd justenough
npm ci
npm run verify    # compile the contract (6 circuits) -> typecheck -> 118 tests -> build the web demo
npm run preview   # open the printed URL (add ?lang=en for English); the compiled circuits run in your browser, no wallet needed

# Optional, real network with real proofs (needs Docker): local node + indexer + proof server
npm run devnet:up && npm run devnet:e2e   # deploy -> issue -> register -> apply -> close -> select -> claim
```

Demo flow (7 screens): issue a credential → read the programme's public policy → apply with one proof → watch two cheating attempts get refused by the circuit → the operator reveals the draw seed it committed before anyone applied and selects 5 of 21 anonymous receipts, which the page re-checks → the selected applicant claims. The "What the chain sees" panel names every call, lists what it disclosed and re-scans the public ledger and that call's transcript for the applicant's private values (0 found at every step); the other tab shows what stays on the applicant's device. `?preset=grant` runs the same flow as a Web3 community grant (age 19–34, lives in Seoul, enrolled student, one grant per person); `?lang=en` or `?lang=ko` picks the language. The last screen shows the same flow's real-network run.

