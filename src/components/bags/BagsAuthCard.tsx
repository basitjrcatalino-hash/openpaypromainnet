"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ExternalLink, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  bagsAgentAuthCallback,
  bagsAgentAuthInit,
  bagsAuthMe,
} from "@/lib/bags.functions";
import { getStoredBagsAgentKey, storeBagsAgentKey } from "@/lib/bags-client";
import { ensureBuffer } from "@/lib/buffer-polyfill";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function BagsAuthCard({ className }: Props) {
  const authMe = useServerFn(bagsAuthMe);
  const agentInit = useServerFn(bagsAgentAuthInit);
  const agentCallback = useServerFn(bagsAgentAuthCallback);

  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAgentKey(getStoredBagsAgentKey());
  }, []);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["bags-auth-me"],
    queryFn: () => authMe(),
    staleTime: 60_000,
    retry: 1,
  });

  async function signInWithBags() {
    setBusy(true);
    try {
      await ensureBuffer();
      const { connectBagsWallet, signBagsAuthChallenge } = await import("@/lib/bags-sign");
      const address = await connectBagsWallet();
      const init = await agentInit({ data: { address } });
      toast.message("Sign the Bags auth challenge in Phantom…");
      const { signatureBase58 } = await signBagsAuthChallenge(init.message);
      const done = await agentCallback({
        data: {
          address,
          signature: signatureBase58,
          nonce: init.nonce,
          keyName: "OpenPay Pro",
        },
      });
      if (done.mfaRequired) {
        throw new Error(
          `Bags MFA required (${done.mfaMethod}). Complete MFA in bags.fm / CLI, then retry.`,
        );
      }
      if (!done.apiKey) throw new Error("No API key returned from Bags auth");
      storeBagsAgentKey(done.apiKey);
      setAgentKey(done.apiKey);
      toast.success(done.isSignup ? "Bags account created & linked" : "Signed in to Bags");
      await refetch();
    } catch (err) {
      const msg = (err as Error).message || "Bags wallet auth failed";
      toast.error(
        /reading 'from'|Buffer/i.test(msg)
          ? "Wallet runtime failed to load (Buffer). Refresh and try again."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  function clearAgentKey() {
    storeBagsAgentKey(null);
    setAgentKey(null);
    toast.message("Cleared Bags wallet session key");
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "mb-4 flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Bags API auth…
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div
        className={cn(
          "mb-4 rounded-2xl bg-amber-500/15 px-3 py-3 text-sm text-amber-800 dark:text-amber-100",
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Bags API not authenticated</div>
            <p className="mt-0.5 text-xs opacity-90">
              {(error as Error)?.message ||
                "Set BAGS_API_KEY on the server, then retry."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs font-semibold underline-offset-2 hover:underline"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? "Retrying…" : "Retry API auth"}
              </button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full"
                disabled={busy}
                onClick={() => void signInWithBags()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in with Phantom"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const user = data.user;
  const uuidMatch =
    data.configuredUuid && user.uuid && data.configuredUuid === user.uuid;

  return (
    <div className={cn("mb-4 space-y-2", className)}>
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 px-3 py-3">
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <BadgeCheck className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            <span>Bags · @{user.username || "unknown"}</span>
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
              {user.status || "authed"}
            </span>
            {uuidMatch ? (
              <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                UUID match
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {user.pref_name || user.uuid}
            {user.primaryWallet
              ? ` · ${user.primaryWallet.slice(0, 4)}…${user.primaryWallet.slice(-4)}`
              : ""}
            {user.points != null ? ` · ${user.points} pts` : ""}
          </div>
        </div>
        <a
          href={
            user.username
              ? `https://bags.fm/${user.username}`
              : data.partnerRefUrl || "https://bags.fm/?ref=mrwain"
          }
          target="_blank"
          rel="noreferrer"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background/60 text-muted-foreground press"
          aria-label="Open Bags profile"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2.5">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          {agentKey
            ? "Phantom Bags session key stored for this browser tab"
            : "Optional: wallet-sign into Bags (Agent V2 auth)"}
        </span>
        {agentKey ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full"
            onClick={clearAgentKey}
          >
            Clear
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 rounded-full"
            disabled={busy}
            onClick={() => void signInWithBags()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in with Phantom"}
          </Button>
        )}
      </div>
    </div>
  );
}
