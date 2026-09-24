// In-process Midnight simulator: one shared public ledger, many parties with their own private state.
// It executes the *compiled* contract (contract/src/managed) with @midnight-ntwrk/compact-runtime,
// i.e. the same circuit logic the proof server proves. It does not generate proofs or fees.
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
  type CircuitResults,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger as readLedger,
  pureCircuits,
  type EligibilityPolicy as ContractPolicy,
  type Ledger,
  type Witnesses,
} from '../../../contract/src/managed/justenough/contract/index.js';
import { witnesses as defaultWitnesses, type JustEnoughPrivateState } from '../../../contract/src/witnesses';
import { bytesToHex } from './mapping';

export type PrivateInput = { witness: string; value: unknown };

export interface TxReport<R> {
  circuit: string;
  result: R;
  /** Ops that go on-chain (public transcript). */
  publicTranscriptDump: string;
  publicOps: number;
  /** Values that only fed the proof, on this party's device. */
  privateInputs: PrivateInput[];
  privateOutputsDump: string;
}

const COIN_PUBLIC_KEY = '0'.repeat(64);

/** JSON with bigint → decimal and bytes → hex, for dumps and the UI. */
export function dump(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Uint8Array) return bytesToHex(v);
    return v;
  });
}

type PS = JustEnoughPrivateState;

export class SimulatedNetwork {
  private ctx: CircuitContext<PS>;
  readonly address: string;
  readonly txLog: Array<TxReport<unknown>> = [];

  private constructor(ctx: CircuitContext<PS>, address: string) {
    this.ctx = ctx;
    this.address = address;
  }

  /** Deploy: the constructor pins issuerKey(issuerSecret) as the issuer. */
  static deploy(issuerSecret: Uint8Array): SimulatedNetwork {
    const contract = new Contract<PS>(defaultWitnesses);
    const init = contract.initialState(createConstructorContext<PS>({ secret: issuerSecret }, COIN_PUBLIC_KEY));
    const address = sampleContractAddress();
    const ctx = createCircuitContext<PS>(address, init.currentZswapLocalState, init.currentContractState, init.currentPrivateState);
    return new SimulatedNetwork(ctx, address);
  }

  party(state: PS, overrides: Partial<Witnesses<PS>> = {}): Party {
    return new Party(this, state, overrides);
  }

  ledger(): Ledger {
    return readLedger(this.ctx.currentQueryContext.state);
  }

  /** Everything an observer of the chain can read about this contract. */
  publicStateDump(): string {
    const l = this.ledger();
    const programs = [...l.programs].map(([id, p]) => ({
      id,
      program: p,
      receipts: [...l.applications.lookup(id)],
      applicants: l.applicantCount.lookup(id).read(),
      selected: l.selectedCount.lookup(id).read(),
    }));
    return dump({
      issuer: l.issuer,
      issuedCount: l.issuedCount,
      credentialsRoot: l.credentials.root(),
      programs,
      raw: this.ctx.currentQueryContext.state.toString(),
    });
  }

  /** @internal run one circuit for a party against the shared ledger. */
  run<R>(
    party: Party,
    circuit: string,
    call: (contract: Contract<PS>, ctx: CircuitContext<PS>) => CircuitResults<PS, R>,
  ): TxReport<R> {
    const log: PrivateInput[] = [];
    const contract = party.contractWithLog(log);
    const ctx: CircuitContext<PS> = { ...this.ctx, currentPrivateState: party.state };
    const res = call(contract, ctx); // throws on a failed assert: nothing is committed
    this.ctx = { ...res.context };
    party.state = res.context.currentPrivateState;
    const report: TxReport<R> = {
      circuit,
      result: res.result,
      publicTranscriptDump: dump(res.proofData.publicTranscript),
      publicOps: res.proofData.publicTranscript.length,
      privateInputs: log,
      privateOutputsDump: dump(log),
    };
    this.txLog.push(report as TxReport<unknown>);
    return report;
  }
}

export class Party {
  state: PS;

  constructor(
    private readonly net: SimulatedNetwork,
    state: PS,
    private readonly overrides: Partial<Witnesses<PS>>,
  ) {
    this.state = state;
  }

  /** @internal a contract whose witnesses record what they hand to the circuit. */
  contractWithLog(log: PrivateInput[]): Contract<PS> {
    const merged = { ...defaultWitnesses, ...this.overrides } as Witnesses<PS>;
    const wrapped = Object.fromEntries(
      Object.entries(merged).map(([name, fn]) => [
        name,
        (...args: unknown[]) => {
          const out = (fn as (...a: unknown[]) => [PS, unknown])(...args);
          log.push({ witness: name, value: out[1] });
          return out;
        },
      ]),
    ) as unknown as Witnesses<PS>;
    return new Contract<PS>(wrapped);
  }

  holderKey(): Uint8Array {
    return pureCircuits.holderKey(this.state.secret);
  }

  /** The commitment the issuer publishes for this holder's credential. */
  commitment(): Uint8Array {
    const { credential, salt } = this.state;
    if (!credential || !salt) throw new Error('This party holds no credential');
    return pureCircuits.credentialCommitment(credential, this.holderKey(), salt);
  }

  receiptFor(programId: Uint8Array): Uint8Array {
    return pureCircuits.nullifierFor(this.state.secret, programId);
  }

  issueCredential(commitment: Uint8Array): TxReport<[]> {
    return this.net.run(this, 'issueCredential', (c, ctx) => c.impureCircuits.issueCredential(ctx, commitment));
  }

  registerProgram(programId: Uint8Array, policy: ContractPolicy, capacity: bigint): TxReport<[]> {
    return this.net.run(this, 'registerProgram', (c, ctx) => c.impureCircuits.registerProgram(ctx, programId, policy, capacity));
  }

  apply(programId: Uint8Array): TxReport<Uint8Array> {
    return this.net.run(this, 'apply', (c, ctx) => c.impureCircuits.apply(ctx, programId));
  }

  closeProgram(programId: Uint8Array): TxReport<[]> {
    return this.net.run(this, 'closeProgram', (c, ctx) => c.impureCircuits.closeProgram(ctx, programId));
  }

  selectApplicant(programId: Uint8Array, receipt: Uint8Array): TxReport<[]> {
    return this.net.run(this, 'selectApplicant', (c, ctx) => c.impureCircuits.selectApplicant(ctx, programId, receipt));
  }

  claimBenefit(programId: Uint8Array): TxReport<Uint8Array> {
    return this.net.run(this, 'claimBenefit', (c, ctx) => c.impureCircuits.claimBenefit(ctx, programId));
  }
}
