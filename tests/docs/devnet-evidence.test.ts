// The README, deck and video quote docs/devnet-run.json (a real run on a local Midnight network).
// These checks keep those claims tied to the recorded evidence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Step = { step: string; txId?: string; refused?: string; commitmentMatches?: boolean; isApplicantA?: boolean; attributeValuesFoundInPublicState?: number };
const run = JSON.parse(readFileSync(join(__dirname, '..', '..', 'docs/devnet-run.json'), 'utf8')) as { network: string; steps: Step[] };
const by = (name: string) => run.steps.find((s) => s.step === name);

describe('recorded devnet run', () => {
  it('confirmed 8 transactions from deploy to claim', () => {
    expect(run.network).toMatch(/local devnet/);
    expect(run.steps.filter((s) => s.txId).map((s) => s.step)).toEqual([
      'deploy',
      'issueCredential(a)',
      'issueCredential(b)',
      'registerProgram',
      'apply(A)',
      'closeProgram',
      'selectApplicant',
      'claimBenefit(A)',
    ]);
  });

  it('the circuit refused the ineligible and the duplicate application', () => {
    expect(by('apply(B)')?.refused).toMatch(/Credential does not meet the eligibility policy/);
    expect(by('apply(A) again')?.refused).toMatch(/Already applied to this program/);
  });

  it('the revealed seed matched its registration commitment and the lowest ticket was selected', () => {
    expect(by('closeProgram')?.commitmentMatches).toBe(true);
    expect(by('selectApplicant')?.isApplicantA).toBe(true);
  });

  it('the indexer public state held no attribute value', () => {
    expect(by('indexer state')?.attributeValuesFoundInPublicState).toBe(0);
  });
});
