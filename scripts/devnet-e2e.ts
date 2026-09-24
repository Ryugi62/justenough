// Real-network walk-through: same contract, same witnesses, real ZK proofs from a proof server,
// real transactions. One fee-paying wallet acts for every role: roles are defined by the witness
// secret, not by the wallet key.
//
// Local devnet (node + indexer + proof server, devnet/compose.yml):
//   docker compose -f devnet/compose.yml up -d --wait
//   npm run compile && npm run devnet:e2e              # writes docs/devnet-run.json
// Preprod (public testnet; needs a proof server on :6300 and a faucet-funded seed):
//   MIDNIGHT_NETWORK=preprod MIDNIGHT_PREPROD_SEED=<hex> npm run devnet:e2e -- --address   # print the address for the faucet
//   MIDNIGHT_NETWORK=preprod MIDNIGHT_PREPROD_SEED=<hex> npm run devnet:e2e               # writes docs/preprod-run.json
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type EnvironmentConfiguration, waitForFunds } from '@midnight-ntwrk/testkit-js';
import { Contract, ledger, pureCircuits } from '../contract/src/managed/justenough/contract/index.js';
import { witnesses, type JustEnoughPrivateState } from '../contract/src/witnesses';
import { MidnightWalletProvider, syncWallet } from './devnet-wallet';
import { bytesToHex, programIdFrom, toContractCredential, toContractPolicy } from '../src/adapters/simulator/mapping';
import { atomsFromStateDump, attributeValuesIn } from '../src/adapters/leak-scan';
import { DEMO_PROGRAM, policyFromClause } from '../src/domain/notices';
import { ymd } from '../src/domain/dates';
import { SIDO } from '../src/domain/regions';

// @ts-expect-error apollo needs a global WebSocket in Node
globalThis.WebSocket = WebSocket;

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', transport: { target: 'pino-pretty' } });
const NETWORKS = {
  local: {
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node: 'http://127.0.0.1:9944',
    nodeWS: 'ws://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
  },
  preprod: {
    networkId: 'preprod',
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    nodeWS: 'wss://rpc.preprod.midnight.network',
    proofServer: process.env.MIDNIGHT_PROOF_SERVER ?? 'http://127.0.0.1:6300',
  },
} as const;
const NETWORK = (process.env.MIDNIGHT_NETWORK ?? 'local') as keyof typeof NETWORKS;
if (!(NETWORK in NETWORKS)) throw new Error(`MIDNIGHT_NETWORK must be local or preprod, got ${NETWORK}`);
const LOCAL = NETWORKS[NETWORK];
// The local devnet's genesis wallet is pre-funded; Preprod needs a faucet-funded seed.
const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const SEED = NETWORK === 'local' ? GENESIS_SEED : process.env.MIDNIGHT_PREPROD_SEED?.trim();
if (!SEED || !/^[0-9a-fA-F]{64}$/.test(SEED)) throw new Error('Set MIDNIGHT_PREPROD_SEED to a 64-hex-char seed');
const OUT = NETWORK === 'local' ? 'docs/devnet-run.json' : 'docs/preprod-run.json';

const zkConfigPath = resolve('contract/src/managed/justenough');
const compiled = CompiledContract.make('JustEnough', Contract).pipe(
  CompiledContract.withWitnesses(witnesses as never),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

const rnd = () => crypto.getRandomValues(new Uint8Array(32));
type PS = JustEnoughPrivateState;

async function main() {
  const t0 = Date.now();
  setNetworkId(LOCAL.networkId);
  const env: EnvironmentConfiguration = { ...LOCAL, walletNetworkId: LOCAL.networkId, faucet: '' };
  const wallet = await MidnightWalletProvider.build(logger, env, { kind: 'seed', value: SEED! });
  if (process.argv.includes('--address')) {
    console.log(wallet.address());
    process.exit(0);
  }
  await wallet.start();
  await syncWallet(logger, wallet.wallet, 60 * 60_000);
  if (NETWORK !== 'local') {
    // registers NIGHT for DUST generation and waits until fees can be paid
    const night = await waitForFunds(wallet.wallet, env, false, wallet.keystore);
    logger.info(`NIGHT balance ${night}`);
  }

  const zk = new NodeZkConfigProvider<string>(zkConfigPath);
  const providers = {
    privateStateProvider: levelPrivateStateProvider<string, PS>({
      privateStateStoreName: `justenough-${Date.now()}`,
      privateStoragePasswordProvider: () => 'JustEnough-Devnet-Only-Password-1',
      accountId: wallet.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(LOCAL.indexer, LOCAL.indexerWS),
    zkConfigProvider: zk,
    proofProvider: httpClientProofProvider(LOCAL.proofServer, zk),
    walletProvider: wallet,
    midnightProvider: wallet,
  };

  const secrets = { issuer: rnd(), operator: rnd(), a: rnd(), b: rnd() };
  const credA = { birthDate: ymd(1999, 4, 17), sido: SIDO.SEOUL, sigungu: 11620, student: false, employed: false, incomePct: 120, validUntil: ymd(2027, 3, 31) };
  const credB = { ...credA, birthDate: ymd(1998, 11, 3), sigungu: 11680, employed: true, incomePct: 90 };
  const states: Record<string, PS> = {
    issuer: { secret: secrets.issuer },
    operator: { secret: secrets.operator },
    a: { secret: secrets.a, credential: toContractCredential(credA), salt: rnd() },
    b: { secret: secrets.b, credential: toContractCredential(credB), salt: rnd() },
  };

  const steps: Array<Record<string, unknown>> = [];
  const record = (step: string, data: Record<string, unknown>) => {
    steps.push({ step, ...data });
    logger.info({ step, ...data }, step);
  };

  // 1. deploy (issuer)
  const deployed = await deployContract(providers as never, {
    compiledContract: compiled as never,
    privateStateId: 'issuer',
    initialPrivateState: states.issuer,
  } as never);
  const address = (deployed as { deployTxData: { public: { contractAddress: string; txId: string; blockHeight: number } } }).deployTxData.public;
  record('deploy', { contractAddress: address.contractAddress, txId: address.txId, blockHeight: address.blockHeight });

  providers.privateStateProvider.setContractAddress(address.contractAddress as never);
  for (const id of ['operator', 'a', 'b']) await providers.privateStateProvider.set(id, states[id]!);

  const call = async (privateStateId: string, circuitId: string, args: unknown[]) => {
    const started = Date.now();
    const res = (await submitCallTx(providers as never, {
      compiledContract: compiled as never,
      contractAddress: address.contractAddress,
      privateStateId,
      circuitId,
      args,
    } as never)) as { public: { txId: string; blockHeight: number }; private: { result: unknown } };
    return { txId: res.public.txId, blockHeight: res.public.blockHeight, ms: Date.now() - started, result: res.private.result };
  };

  // 2. issue two credentials (only hashes go on chain)
  for (const who of ['a', 'b'] as const) {
    const s = states[who]!;
    const commitment = pureCircuits.credentialCommitment(s.credential!, pureCircuits.holderKey(s.secret), s.salt!);
    const r = await call('issuer', 'issueCredential', [commitment]);
    record(`issueCredential(${who})`, { txId: r.txId, blockHeight: r.blockHeight, provingAndSubmitMs: r.ms, commitment: bytesToHex(commitment) });
  }

  // 3. register the demo programme
  const programId = programIdFrom(DEMO_PROGRAM.id);
  const r3 = await call('operator', 'registerProgram', [programId, toContractPolicy(policyFromClause(DEMO_PROGRAM)), 5n]);
  record('registerProgram', { txId: r3.txId, blockHeight: r3.blockHeight, provingAndSubmitMs: r3.ms });

  // 4. applicant A applies — real proof of membership + policy
  const r4 = await call('a', 'apply', [programId]);
  record('apply(A)', { txId: r4.txId, blockHeight: r4.blockHeight, provingAndSubmitMs: r4.ms, receipt: bytesToHex(r4.result as Uint8Array) });

  // 5. applicant B (employed) cannot even build the transaction
  try {
    await call('b', 'apply', [programId]);
    record('apply(B)', { unexpected: 'accepted' });
  } catch (e) {
    record('apply(B)', { refused: String((e as Error).message).slice(0, 200) });
  }

  // 6. A tries again
  try {
    await call('a', 'apply', [programId]);
    record('apply(A) again', { unexpected: 'accepted' });
  } catch (e) {
    record('apply(A) again', { refused: String((e as Error).message).slice(0, 200) });
  }

  // 7. close (reveals the committed draw seed), select the lowest ticket, A claims
  const r7 = await call('operator', 'closeProgram', [programId]);
  const afterClose = ledger((await providers.publicDataProvider.queryContractState(address.contractAddress as never))!.data);
  const seed = afterClose.drawSeeds.lookup(programId);
  const commitmentMatches =
    bytesToHex(pureCircuits.seedCommitmentOf(seed)) === bytesToHex(afterClose.programs.lookup(programId).seedCommitment);
  record('closeProgram', { txId: r7.txId, blockHeight: r7.blockHeight, revealedSeed: bytesToHex(seed), commitmentMatches });
  const tickets = [...afterClose.applications.lookup(programId)].map(([r]) => ({ receipt: r, ticket: bytesToHex(pureCircuits.drawTicket(seed, r)) }));
  tickets.sort((x, y) => (x.ticket < y.ticket ? -1 : 1));
  const r8 = await call('operator', 'selectApplicant', [programId, tickets[0]!.receipt]);
  record('selectApplicant', { txId: r8.txId, blockHeight: r8.blockHeight, lowestTicket: tickets[0]!.ticket, isApplicantA: bytesToHex(tickets[0]!.receipt) === bytesToHex(r4.result as Uint8Array) });
  const r9 = await call('a', 'claimBenefit', [programId]);
  record('claimBenefit(A)', { txId: r9.txId, blockHeight: r9.blockHeight, provingAndSubmitMs: r9.ms });

  // 8. read the public state back from the indexer
  const state = await providers.publicDataProvider.queryContractState(address.contractAddress as never);
  const l = ledger(state!.data);
  const publicView = {
    issuedCount: Number(l.issuedCount),
    applicants: Number(l.applicantCount.lookup(programId).read()),
    selected: Number(l.selectedCount.lookup(programId).read()),
    receipts: [...l.applications.lookup(programId)].map(([r, s]) => ({ receipt: bytesToHex(r), status: s })),
    policy: Object.fromEntries(Object.entries(l.programs.lookup(programId).policy).map(([k, v]) => [k, String(v)])),
  };
  const raw = state!.data.toString();
  const needles = [credA.birthDate, credA.sigungu, credA.incomePct, credA.validUntil];
  const leaked = [
    ...attributeValuesIn(atomsFromStateDump(raw), needles).map(String),
    ...needles.map(String).filter((n) => JSON.stringify(publicView).includes(`"${n}"`)),
  ];
  record('indexer state', { ...publicView, publicAtomsScanned: atomsFromStateDump(raw).length, attributeValuesFoundInPublicState: leaked.length, leaked });

  const out = { network: NETWORK === 'local' ? 'local devnet (midnight-node 1.0.0, indexer 4.3.3, proof-server 8.1.0)' : 'Midnight Preprod', compiler: 'compactc 0.31.1', ranAt: new Date().toISOString(), totalSeconds: Math.round((Date.now() - t0) / 1000), contractAddress: address.contractAddress, steps };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  logger.info(`wrote ${OUT}`);
  await wallet.stop();
  process.exit(leaked.length ? 1 : 0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
