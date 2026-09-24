// Composition root for the browser demo: wires the simulator adapters and seeds a synthetic world.
// Every persona is synthetic (rules art. 10 ① 4). Seeded so the demo (and the video) is reproducible.
import { SimulatedNetwork, type Party, type TxReport } from '../src/adapters/simulator/simulated-network';
import { SimulatedHolder, SimulatedLedgerView, SimulatedOperator } from '../src/adapters/simulator/ports';
import { toContractCredential } from '../src/adapters/simulator/mapping';
import { registerProgramFromClause } from '../src/application/use-cases';
import { explainEligibility, type Credential } from '../src/domain/eligibility';
import { ymd } from '../src/domain/dates';
import { SIDO } from '../src/domain/regions';
import { DEMO_PRESETS, type DemoPreset, type PresetId } from '../src/domain/presets';

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function secretFrom(r: () => number): Uint8Array {
  return Uint8Array.from({ length: 32 }, () => Math.floor(r() * 256));
}

export interface World {
  preset: DemoPreset;
  net: SimulatedNetwork;
  view: SimulatedLedgerView;
  operator: SimulatedOperator;
  issuer: Party;
  programId: string;
  a: SimulatedHolder;
  b: SimulatedHolder;
  background: number;
}

// Seeds make each preset reproducible (screens, video). The draw is still honest: the page audits it.
const SEEDS: Record<PresetId, number> = { youth: 20260929, grant: 20260924 };

export async function createWorld(presetId: PresetId = 'youth', seed = SEEDS[presetId]): Promise<World> {
  const preset = DEMO_PRESETS[presetId];
  const r = rng(seed);
  const issuerSecret = secretFrom(r);
  const net = SimulatedNetwork.deploy(issuerSecret);
  const issuer = net.party({ secret: issuerSecret });
  const operator = new SimulatedOperator(net.party({ secret: secretFrom(r) }));
  const view = new SimulatedLedgerView(net);
  const { programId } = await registerProgramFromClause(operator, preset.clause, preset.capacity);

  const wallet = (c: Credential) => {
    const p = net.party({ secret: secretFrom(r), credential: toContractCredential(c), salt: secretFrom(r) });
    issuer.issueCredential(p.commitment());
    return new SimulatedHolder(p);
  };

  // 36 synthetic neighbours; the eligible ones apply before applicant A does.
  let background = 0;
  const policy = view.program(programId)!.policy;
  for (let i = 0; i < 36; i++) {
    const c: Credential = {
      birthDate: ymd(1989 + Math.floor(r() * 19), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)),
      sido: r() < 0.85 ? SIDO.SEOUL : SIDO.GYEONGGI,
      sigungu: [11620, 11650, 11680][Math.floor(r() * 3)]!,
      student: r() < 0.3,
      employed: r() < 0.2,
      incomePct: Math.floor(40 + r() * 140),
      validUntil: ymd(2027, 12, 31),
    };
    if (c.sido !== SIDO.SEOUL) c.sigungu = 41110;
    const h = wallet(c);
    if (explainEligibility(c, policy).eligible) {
      await h.apply(programId);
      background++;
    }
  }
  const a = wallet(preset.applicantA);
  const b = wallet(preset.applicantB);
  return { preset, net, view, operator, issuer, programId, a, b, background };
}

export function lastTx(world: World): TxReport<unknown> | undefined {
  return world.net.txLog[world.net.txLog.length - 1];
}
