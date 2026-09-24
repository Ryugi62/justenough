import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Credential = { birthDate: bigint;
                           sido: bigint;
                           sigungu: bigint;
                           student: boolean;
                           employed: boolean;
                           incomePct: bigint;
                           validUntil: bigint
                         };

export type EligibilityPolicy = { minBirthDate: bigint;
                                  maxBirthDate: bigint;
                                  sido: bigint;
                                  sigungu: bigint;
                                  requireStudent: boolean;
                                  requireUnemployed: boolean;
                                  maxIncomePct: bigint;
                                  referenceDate: bigint
                                };

export enum ProgramStatus { open = 0, closed = 1 }

export enum ApplicationStatus { submitted = 0, selected = 1, claimed = 2 }

export type Program = { policy: EligibilityPolicy;
                        operator: Uint8Array;
                        status: ProgramStatus;
                        capacity: bigint;
                        seedCommitment: Uint8Array
                      };

export type Witnesses<PS> = {
  localSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  heldCredential(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Credential];
  credentialSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  credentialPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
                 commitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                                   path: { sibling: { field: bigint
                                                                    },
                                                           goes_left: boolean
                                                         }[]
                                                 }];
}

export type ImpureCircuits<PS> = {
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerProgram(context: __compactRuntime.CircuitContext<PS>,
                  programId_0: Uint8Array,
                  policy_0: EligibilityPolicy,
                  capacity_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  apply(context: __compactRuntime.CircuitContext<PS>, programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  closeProgram(context: __compactRuntime.CircuitContext<PS>,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  selectApplicant(context: __compactRuntime.CircuitContext<PS>,
                  programId_0: Uint8Array,
                  receipt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimBenefit(context: __compactRuntime.CircuitContext<PS>,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerProgram(context: __compactRuntime.CircuitContext<PS>,
                  programId_0: Uint8Array,
                  policy_0: EligibilityPolicy,
                  capacity_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  apply(context: __compactRuntime.CircuitContext<PS>, programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  closeProgram(context: __compactRuntime.CircuitContext<PS>,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  selectApplicant(context: __compactRuntime.CircuitContext<PS>,
                  programId_0: Uint8Array,
                  receipt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimBenefit(context: __compactRuntime.CircuitContext<PS>,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
  issuerKey(sk_0: Uint8Array): Uint8Array;
  operatorKey(sk_0: Uint8Array): Uint8Array;
  holderKey(sk_0: Uint8Array): Uint8Array;
  nullifierFor(sk_0: Uint8Array, programId_0: Uint8Array): Uint8Array;
  drawSeedFor(sk_0: Uint8Array, programId_0: Uint8Array): Uint8Array;
  seedCommitmentOf(seed_0: Uint8Array): Uint8Array;
  drawTicket(seed_0: Uint8Array, receipt_0: Uint8Array): Uint8Array;
  credentialCommitment(c_0: Credential, holder_0: Uint8Array, salt_0: Uint8Array): Uint8Array;
  meetsPolicy(c_0: Credential, p_0: EligibilityPolicy): boolean;
}

export type Circuits<PS> = {
  issuerKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  operatorKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  holderKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  nullifierFor(context: __compactRuntime.CircuitContext<PS>,
               sk_0: Uint8Array,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  drawSeedFor(context: __compactRuntime.CircuitContext<PS>,
              sk_0: Uint8Array,
              programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  seedCommitmentOf(context: __compactRuntime.CircuitContext<PS>,
                   seed_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  drawTicket(context: __compactRuntime.CircuitContext<PS>,
             seed_0: Uint8Array,
             receipt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  credentialCommitment(context: __compactRuntime.CircuitContext<PS>,
                       c_0: Credential,
                       holder_0: Uint8Array,
                       salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  meetsPolicy(context: __compactRuntime.CircuitContext<PS>,
              c_0: Credential,
              p_0: EligibilityPolicy): __compactRuntime.CircuitResults<PS, boolean>;
  issueCredential(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerProgram(context: __compactRuntime.CircuitContext<PS>,
                  programId_0: Uint8Array,
                  policy_0: EligibilityPolicy,
                  capacity_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  apply(context: __compactRuntime.CircuitContext<PS>, programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  closeProgram(context: __compactRuntime.CircuitContext<PS>,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  selectApplicant(context: __compactRuntime.CircuitContext<PS>,
                  programId_0: Uint8Array,
                  receipt_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimBenefit(context: __compactRuntime.CircuitContext<PS>,
               programId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly issuer: Uint8Array;
  credentials: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  readonly issuedCount: bigint;
  programs: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Program;
    [Symbol.iterator](): Iterator<[Uint8Array, Program]>
  };
  applications: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): {
      isEmpty(): boolean;
      size(): bigint;
      member(key_1: Uint8Array): boolean;
      lookup(key_1: Uint8Array): ApplicationStatus;
      [Symbol.iterator](): Iterator<[Uint8Array, ApplicationStatus]>
    }
  };
  applicantCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { read(): bigint }
  };
  selectedCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { read(): bigint }
  };
  drawSeeds: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
