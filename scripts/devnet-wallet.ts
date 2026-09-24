// Minimal fee-paying wallet for the devnet walk-through.
// Follows the wallet-provider pattern shown in midnightntwrk/example-hello-world (Apache-2.0),
// reduced to what this script needs.
import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProvider, UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import type { FacadeState, UnshieldedKeystore, WalletFacade } from '@midnight-ntwrk/wallet-sdk';
import { type EnvironmentConfiguration, FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import * as Rx from 'rxjs';
import type { Logger } from 'pino';

export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  private constructor(
    readonly wallet: WalletFacade,
    private readonly zswap: ZswapSecretKeys,
    private readonly dust: DustSecretKey,
    readonly keystore: UnshieldedKeystore,
  ) {}

  /** Unshielded (NIGHT) address to paste into a faucet. */
  address(): string {
    const a = this.keystore.getBech32Address() as unknown as { asString?: () => string };
    return a.asString ? a.asString() : String(a);
  }

  static async build(logger: Logger, env: EnvironmentConfiguration, secret: { kind: 'seed'; value: string }) {
    const built = (await FluentWalletBuilder.forEnvironment(env)
      .withDustOptions({ ledgerParams: LedgerParameters.initialParameters(), additionalFeeOverhead: 1_000n, feeBlocksMargin: 5 })
      .withSeed(secret.value)
      .buildWithoutStarting()) as unknown as {
      wallet: WalletFacade;
      seeds: { shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };
    logger.info('wallet built');
    return new MidnightWalletProvider(
      built.wallet,
      ZswapSecretKeys.fromSeed(built.seeds.shielded),
      DustSecretKey.fromSeed(built.seeds.dust),
      built.keystore,
    );
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswap.coinPublicKey;
  }
  getEncryptionPublicKey(): EncPublicKey {
    return this.zswap.encryptionPublicKey;
  }
  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(tx, { shieldedSecretKeys: this.zswap, dustSecretKey: this.dust }, { ttl });
    return this.wallet.finalizeRecipe(recipe);
  }
  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }
  start(): Promise<void> {
    return this.wallet.start(this.zswap, this.dust);
  }
  stop(): Promise<void> {
    return this.wallet.stop();
  }
}

const complete = (p: unknown) =>
  !!p && typeof (p as { isStrictlyComplete?: unknown }).isStrictlyComplete === 'function' && (p as { isStrictlyComplete: () => boolean }).isStrictlyComplete();

export function syncWallet(logger: Logger, wallet: WalletFacade, timeout: number): Promise<FacadeState> {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((s: FacadeState) => complete(s.shielded.state.progress) && complete(s.dust.state.progress) && complete(s.unshielded.progress)),
      Rx.tap(() => logger.info('wallet synced')),
      Rx.timeout({ each: timeout, with: () => Rx.throwError(() => new Error('wallet sync timeout')) }),
    ),
  );
}
