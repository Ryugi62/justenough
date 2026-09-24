// Application ports implemented on top of the in-process simulator.
// A Midnight-network adapter would implement the same interfaces with deployContract/callTx.
import { ApplicationStatus, ProgramStatus, pureCircuits } from '../../../contract/src/managed/justenough/contract/index.js';
import type {
  DrawTicketHasher,
  Hex,
  HolderPort,
  OperatorPort,
  ProgramView,
  PublicLedgerView,
  ReceiptStatus,
} from '../../application/ports';
import type { Credential, EligibilityPolicy } from '../../domain/eligibility';
import { bytesToHex, fromContractCredential, fromContractPolicy, hexToBytes, toContractPolicy } from './mapping';
import type { Party, SimulatedNetwork } from './simulated-network';

const STATUS: Record<ApplicationStatus, ReceiptStatus> = {
  [ApplicationStatus.submitted]: 'submitted',
  [ApplicationStatus.selected]: 'selected',
  [ApplicationStatus.claimed]: 'claimed',
};

export class SimulatedLedgerView implements PublicLedgerView {
  constructor(private readonly net: SimulatedNetwork) {}

  program(id: Hex): ProgramView | undefined {
    const l = this.net.ledger();
    const key = hexToBytes(id);
    if (!l.programs.member(key)) return undefined;
    const p = l.programs.lookup(key);
    return { id, policy: fromContractPolicy(p.policy), capacity: Number(p.capacity), open: p.status === ProgramStatus.open };
  }

  receipts(id: Hex): Array<{ receipt: Hex; status: ReceiptStatus }> {
    const l = this.net.ledger();
    const key = hexToBytes(id);
    if (!l.applications.member(key)) return [];
    return [...l.applications.lookup(key)].map(([r, s]) => ({ receipt: bytesToHex(r), status: STATUS[s] }));
  }

  drawSeed(id: Hex): Hex | undefined {
    const l = this.net.ledger();
    const key = hexToBytes(id);
    return l.drawSeeds.member(key) ? bytesToHex(l.drawSeeds.lookup(key)) : undefined;
  }

  seedCommitment(id: Hex): Hex {
    return bytesToHex(this.net.ledger().programs.lookup(hexToBytes(id)).seedCommitment);
  }

  programIds(): Hex[] {
    return [...this.net.ledger().programs].map(([id]) => bytesToHex(id));
  }

  issuedCount(): number {
    return Number(this.net.ledger().issuedCount);
  }
}

export class SimulatedOperator implements OperatorPort {
  constructor(readonly party: Party) {}
  async registerProgram(id: Hex, policy: EligibilityPolicy, capacity: number): Promise<void> {
    this.party.registerProgram(hexToBytes(id), toContractPolicy(policy), BigInt(capacity));
  }
  async closeProgram(id: Hex): Promise<void> {
    this.party.closeProgram(hexToBytes(id));
  }
  async select(id: Hex, receipt: Hex): Promise<void> {
    this.party.selectApplicant(hexToBytes(id), hexToBytes(receipt));
  }
}

export class SimulatedHolder implements HolderPort {
  constructor(readonly party: Party) {}
  get credential(): Credential {
    const c = this.party.state.credential;
    if (!c) throw new Error('This wallet holds no credential');
    return fromContractCredential(c);
  }
  receiptFor(id: Hex): Hex {
    return bytesToHex(this.party.receiptFor(hexToBytes(id)));
  }
  async apply(id: Hex): Promise<Hex> {
    return bytesToHex(this.party.apply(hexToBytes(id)).result);
  }
  async claim(id: Hex): Promise<Hex> {
    return bytesToHex(this.party.claimBenefit(hexToBytes(id)).result);
  }
}

/** The contract's own `drawTicket` pure circuit, so the audit hashes exactly like the chain. */
export const contractTicketHasher: DrawTicketHasher = {
  ticket: (seed, receipt) => bytesToHex(pureCircuits.drawTicket(hexToBytes(seed), hexToBytes(receipt))),
};
