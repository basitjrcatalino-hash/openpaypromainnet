import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pubkeySchema = z.string().trim().min(32).max(64);
const mintSchema = pubkeySchema;
const amountLamportsSchema = z.coerce.number().int().positive().max(1e15);

function bagsError(err: unknown): never {
  const msg = (err as Error)?.message || "Bags request failed";
  throw new Error(msg.replace(/^Error:\s*/i, ""));
}

export const bagsPing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const {
      bagsPingRemote,
      getBagsUserUuid,
      getBagsPartnerConfig,
      getBagsPartnerWallet,
      getBagsPartnerRef,
      getBagsPartnerRefUrl,
    } = await import("./bags.server");
    try {
      const ping = await bagsPingRemote();
      return {
        ...ping,
        configured: true as const,
        userUuid: getBagsUserUuid(),
        partnerConfig: getBagsPartnerConfig(),
        partnerWallet: getBagsPartnerWallet(),
        partnerRef: getBagsPartnerRef(),
        partnerRefUrl: getBagsPartnerRefUrl(),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsAuthMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getBagsSdk, getBagsUserUuid, getBagsPartnerConfig, getBagsPartnerRefUrl } =
      await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const me = await sdk.auth.me();
      const raw = me.user as typeof me.user & {
        primaryWallet?: string;
        membershipPurchaseWallet?: string;
      };
      return {
        ok: true as const,
        configuredUuid: getBagsUserUuid(),
        partnerConfig: getBagsPartnerConfig(),
        partnerRefUrl: getBagsPartnerRefUrl(),
        user: {
          uuid: raw.uuid,
          username: raw.username,
          status: raw.status,
          pref_name: raw.pref_name,
          picture: raw.picture,
          points: raw.points,
          rank: raw.rank,
          primaryWallet: raw.primaryWallet || raw.membershipPurchaseWallet || null,
        },
      };
    } catch (err) {
      bagsError(err);
    }
  });

/** Bags Agent V2 auth — init challenge for Phantom wallet signature. */
export const bagsAgentAuthInit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ address: pubkeySchema }).parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await fetch("https://public-api-v2.bags.fm/api/v1/agent/v2/auth/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: data.address }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        response?: { message?: string; nonce?: string };
        error?: string;
      };
      if (!res.ok || json.success === false || !json.response?.message || !json.response?.nonce) {
        throw new Error(json.error || `Bags auth init failed (${res.status})`);
      }
      return {
        ok: true as const,
        message: json.response.message,
        nonce: json.response.nonce,
      };
    } catch (err) {
      bagsError(err);
    }
  });

/** Complete Bags Agent V2 auth with wallet signature → API key (returned once to client). */
export const bagsAgentAuthCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        address: pubkeySchema,
        signature: z.string().trim().min(32).max(200),
        nonce: z.string().trim().min(8).max(200),
        keyName: z.string().trim().min(1).max(80).default("OpenPay Pro"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const res = await fetch("https://public-api-v2.bags.fm/api/v1/agent/v2/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: data.address,
          signature: data.signature,
          nonce: data.nonce,
          keyName: data.keyName,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        response?: {
          apiKey?: string;
          keyId?: string;
          isSignup?: boolean;
          mfaRequired?: boolean;
          mfaMethod?: string;
          authCode?: string;
        };
        error?: string;
      };
      if (!res.ok || json.success === false || !json.response) {
        throw new Error(json.error || `Bags auth callback failed (${res.status})`);
      }
      if (json.response.mfaRequired) {
        return {
          ok: true as const,
          mfaRequired: true as const,
          mfaMethod: json.response.mfaMethod || "totp",
          authCode: json.response.authCode || "",
          apiKey: null,
          keyId: null,
          isSignup: false,
        };
      }
      if (!json.response.apiKey || !json.response.keyId) {
        throw new Error("Bags auth did not return an API key");
      }
      return {
        ok: true as const,
        mfaRequired: false as const,
        mfaMethod: null,
        authCode: null,
        apiKey: json.response.apiKey,
        keyId: json.response.keyId,
        isSignup: Boolean(json.response.isSignup),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsCreateTokenInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(32),
        symbol: z.string().trim().min(1).max(10),
        description: z.string().trim().min(1).max(500),
        imageUrl: z.string().url().max(2000),
        telegram: z.string().trim().max(120).optional(),
        twitter: z.string().trim().max(120).optional(),
        website: z.string().url().max(500).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getBagsSdk } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const res = await sdk.tokenLaunch.createTokenInfoAndMetadata({
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        description: data.description,
        imageUrl: data.imageUrl,
        telegram: data.telegram || undefined,
        twitter: data.twitter || undefined,
        website: data.website || undefined,
      });
      return {
        ok: true as const,
        tokenMint: res.tokenMint,
        tokenMetadata: res.tokenMetadata,
        name: res.tokenLaunch?.name ?? data.name,
        symbol: res.tokenLaunch?.symbol ?? data.symbol.toUpperCase(),
        status: res.tokenLaunch?.status ?? null,
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsCreateFeeShareConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tokenMint: mintSchema,
        payer: pubkeySchema,
        claimerWallet: pubkeySchema,
        claimerBps: z.number().int().min(1).max(10_000).default(10_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey, encodeVersionedTx, getBagsPartnerLaunchArgs } = await import(
      "./bags.server"
    );
    try {
      const sdk = getBagsSdk();
      const partnerArgs = getBagsPartnerLaunchArgs();
      const result = await sdk.config.createBagsFeeShareConfig({
        payer: pubkey(data.payer, "payer"),
        baseMint: pubkey(data.tokenMint, "token mint"),
        feeClaimers: [
          {
            user: pubkey(data.claimerWallet, "claimer wallet"),
            userBps: data.claimerBps,
          },
        ],
        ...partnerArgs,
      });

      const flatTxs = [
        ...result.transactions,
        ...result.bundles.flat(),
      ];
      // Deduplicate by serialized bytes
      const seen = new Set<string>();
      const encoded = [];
      for (const tx of flatTxs) {
        const enc = encodeVersionedTx(tx);
        if (seen.has(enc.txBase64)) continue;
        seen.add(enc.txBase64);
        encoded.push(enc);
      }

      return {
        ok: true as const,
        configKey: result.meteoraConfigKey.toBase58(),
        transactions: encoded,
        partnerAttached: Boolean(partnerArgs.partnerConfig),
        partnerConfig: partnerArgs.partnerConfig?.toBase58() ?? null,
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsCreateLaunchTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        metadataUrl: z.string().url().max(2000),
        tokenMint: mintSchema,
        launchWallet: pubkeySchema,
        initialBuyLamports: amountLamportsSchema,
        configKey: pubkeySchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey, encodeVersionedTx } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const tx = await sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: data.metadataUrl,
        tokenMint: pubkey(data.tokenMint, "token mint"),
        launchWallet: pubkey(data.launchWallet, "launch wallet"),
        initialBuyLamports: data.initialBuyLamports,
        configKey: pubkey(data.configKey, "config key"),
      });
      return {
        ok: true as const,
        transaction: encodeVersionedTx(tx),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsGetQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        inputMint: mintSchema,
        outputMint: mintSchema,
        amount: amountLamportsSchema,
        slippageMode: z.enum(["auto", "manual"]).default("auto"),
        slippageBps: z.number().int().min(0).max(10_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const quote = await sdk.trade.getQuote({
        inputMint: pubkey(data.inputMint, "input mint"),
        outputMint: pubkey(data.outputMint, "output mint"),
        amount: data.amount,
        slippageMode: data.slippageMode,
        slippageBps: data.slippageBps,
      });
      return { ok: true as const, quote };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsCreateSwapTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        quote: z.record(z.unknown()),
        userPublicKey: pubkeySchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey, encodeVersionedTx } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const swap = await sdk.trade.createSwapTransaction({
        quoteResponse: data.quote as never,
        userPublicKey: pubkey(data.userPublicKey, "wallet"),
      });
      return {
        ok: true as const,
        transaction: encodeVersionedTx(swap.transaction),
        computeUnitLimit: swap.computeUnitLimit,
        lastValidBlockHeight: swap.lastValidBlockHeight,
        prioritizationFeeLamports: swap.prioritizationFeeLamports,
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsGetClaimTxs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        wallet: pubkeySchema,
        tokenMint: mintSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey, encodeAnyTx } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const txs = await sdk.fee.getClaimTransactions(
        pubkey(data.wallet, "wallet"),
        pubkey(data.tokenMint, "token mint"),
      );
      return {
        ok: true as const,
        transactions: (txs ?? []).map((tx) => encodeAnyTx(tx)),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsGetClaimablePositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ wallet: pubkeySchema }).parse(d))
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const positions = await sdk.fee.getAllClaimablePositions(pubkey(data.wallet, "wallet"));
      return {
        ok: true as const,
        count: positions?.length ?? 0,
        positions: (positions ?? []).map((p) => {
          const row = p as unknown as Record<string, unknown>;
          const base = row.baseMint;
          return {
            baseMint:
              base && typeof base === "object" && base !== null && "toBase58" in base
                ? String((base as { toBase58: () => string }).toBase58())
                : base != null
                  ? String(base)
                  : "",
          };
        }),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsTokenFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tokenMint: mintSchema }).parse(d))
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const mint = pubkey(data.tokenMint, "token mint");
      const [lifetimeFees, creators, claimStats] = await Promise.all([
        sdk.state.getTokenLifetimeFees(mint),
        sdk.state.getTokenCreators(mint),
        sdk.state.getTokenClaimStats(mint).catch(() => []),
      ]);
      return {
        ok: true as const,
        lifetimeFees,
        creators: creators.map((c) => ({
          username: "username" in c ? String((c as { username?: string }).username ?? "") : "",
          provider: "provider" in c ? String((c as { provider?: string }).provider ?? "") : "",
          wallet: String((c as { wallet?: string }).wallet ?? ""),
          bps: "bps" in c ? Number((c as { bps?: number }).bps ?? 0) : 0,
        })),
        claimStats: claimStats.map((s) => ({
          tokenMint: s.tokenMint,
          wallet: s.wallet,
          totalClaimed: s.totalClaimed,
        })),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsTokenCreators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tokenMint: mintSchema }).parse(d))
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const creators = await sdk.state.getTokenCreators(pubkey(data.tokenMint, "token mint"));
      return {
        ok: true as const,
        creators: creators.map((c) => ({
          username: "username" in c ? String((c as { username?: string }).username ?? "") : "",
          provider: "provider" in c ? String((c as { provider?: string }).provider ?? "") : "",
          wallet: String((c as { wallet?: string }).wallet ?? ""),
        })),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsTopTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getBagsSdk } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const tokens = await sdk.state.getTopTokensByLifetimeFees();
      return {
        ok: true as const,
        tokens: tokens.map((t) => {
          const row = t as Record<string, unknown>;
          return {
            tokenMint: String(row.tokenMint ?? row.mint ?? ""),
            name: row.name != null ? String(row.name) : "",
            symbol: row.symbol != null ? String(row.symbol) : "",
            lifetimeFees: String(row.lifetimeFees ?? row.totalFees ?? ""),
            image: row.image != null ? String(row.image) : "",
          };
        }),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsPartnerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ partnerWallet: pubkeySchema.optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const {
      getBagsSdk,
      getBagsUserUuid,
      getBagsPartnerConfig,
      getBagsPartnerWallet,
      getBagsPartnerRef,
      getBagsPartnerRefUrl,
      pubkey,
    } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const me = await sdk.auth.me().catch(() => null);
      const configuredWallet = getBagsPartnerWallet();
      const partnerWallet =
        data.partnerWallet?.trim() ||
        configuredWallet ||
        (me?.user as { primaryWallet?: string } | undefined)?.primaryWallet ||
        null;

      let hasPartnerConfig = false;
      let partnerBps: number | null = null;
      let claimStats: { claimedFees: string; unclaimedFees: string } | null = null;
      if (partnerWallet) {
        const partner = pubkey(partnerWallet, "partner wallet");
        const partnerConfig = await sdk.partner.getPartnerConfig(partner).catch(() => null);
        hasPartnerConfig = Boolean(partnerConfig);
        if (partnerConfig) partnerBps = partnerConfig.bps;
        const stats = await sdk.partner.getPartnerConfigClaimStats(partner).catch(() => null);
        if (stats) {
          claimStats = {
            claimedFees: String(stats.claimedFees),
            unclaimedFees: String(stats.unclaimedFees),
          };
        }
      }
      return {
        ok: true as const,
        configuredUuid: getBagsUserUuid(),
        partnerConfigPda: getBagsPartnerConfig(),
        partnerWallet,
        partnerRef: getBagsPartnerRef(),
        partnerRefUrl: getBagsPartnerRefUrl(),
        me: me?.user
          ? {
              uuid: me.user.uuid,
              username: me.user.username,
              status: me.user.status,
              pref_name: me.user.pref_name,
            }
          : null,
        hasPartnerConfig,
        partnerBps,
        claimStats,
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsClaimPartnerFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ partnerWallet: pubkeySchema }).parse(d))
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey, encodeVersionedTx } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const txs = await sdk.partner.getPartnerConfigClaimTransactions(
        pubkey(data.partnerWallet, "partner wallet"),
      );
      return {
        ok: true as const,
        transactions: (txs ?? []).map((item) => encodeVersionedTx(item.transaction)),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsCreatePartnerConfigTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ partnerWallet: pubkeySchema }).parse(d))
  .handler(async ({ data }) => {
    const { getBagsSdk, pubkey, encodeVersionedTx } = await import("./bags.server");
    try {
      const sdk = getBagsSdk();
      const res = await sdk.partner.getPartnerConfigCreationTransaction(
        pubkey(data.partnerWallet, "partner wallet"),
      );
      return {
        ok: true as const,
        transaction: encodeVersionedTx(res.transaction),
      };
    } catch (err) {
      bagsError(err);
    }
  });

export const bagsSendSignedTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ signedTxBase64: z.string().min(32).max(50_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { bagsSendSignedTransaction } = await import("./bags.server");
    try {
      const signature = await bagsSendSignedTransaction(data.signedTxBase64);
      return { ok: true as const, signature };
    } catch (err) {
      bagsError(err);
    }
  });
