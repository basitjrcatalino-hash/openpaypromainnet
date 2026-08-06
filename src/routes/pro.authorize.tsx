import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Shield, UserRound, Wallet, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { approveProAuthorization, getProAuthorizeContext } from "@/lib/pro-connect.functions";

const SCOPE_META: Record<string, { label: string; desc: string; icon: typeof UserRound }> = {
  profile: {
    label: "Profile",
    desc: "Username, display name, avatar, and wallet address",
    icon: UserRound,
  },
  balance: {
    label: "Balance",
    desc: "Read your OUSD wallet balance",
    icon: Wallet,
  },
  payments: {
    label: "Payments",
    desc: "Request payments from your OpenPay Pro wallet",
    icon: Shield,
  },
};

export const Route = createFileRoute("/pro/authorize")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    client_id: typeof s.client_id === "string" ? s.client_id : "",
    redirect_uri: typeof s.redirect_uri === "string" ? s.redirect_uri : "",
    scope: typeof s.scope === "string" ? s.scope : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.client_id || !search.redirect_uri) {
      throw new Error("Missing client_id or redirect_uri");
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/authpi", search: { next } as never });
    }
  },
  head: () => ({
    meta: [
      { title: "Authorize — OpenPay Pro Connect" },
      {
        name: "description",
        content: "Approve or deny third-party access to your OpenPay Pro account.",
      },
    ],
  }),
  component: ProAuthorizePage,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Authorization request failed</h1>
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function ProAuthorizePage() {
  const search = Route.useSearch();
  const getCtx = useServerFn(getProAuthorizeContext);
  const approve = useServerFn(approveProAuthorization);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getProAuthorizeContext>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getCtx({
      data: {
        client_id: search.client_id,
        redirect_uri: search.redirect_uri,
        scope: search.scope,
      },
    })
      .then((res) => {
        if (cancelled) return;
        setCtx(res);
        if (res.error === "unknown_client") setError("Unknown application.");
        if (res.error === "redirect_uri_mismatch") {
          setError("This redirect URI is not registered for the app.");
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getCtx, search.client_id, search.redirect_uri, search.scope]);

  const scopes = useMemo(() => {
    const raw = (ctx && "scope" in ctx ? ctx.scope : search.scope) || "profile";
    return String(raw).split(/\s+/).filter(Boolean);
  }, [ctx, search.scope]);

  async function onApprove() {
    setBusy(true);
    setError(null);
    try {
      const res = await approve({
        data: {
          client_id: search.client_id,
          redirect_uri: search.redirect_uri,
          scope: search.scope,
          state: search.state ?? null,
        },
      });
      window.location.href = res.redirect_url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function onDeny() {
    try {
      const url = new URL(search.redirect_uri);
      url.searchParams.set("error", "access_denied");
      if (search.state) url.searchParams.set("state", search.state);
      window.location.href = url.toString();
    } catch {
      setError("Invalid redirect URI");
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  const app = ctx && "app" in ctx && ctx.app ? ctx.app : null;
  const user = ctx && "user" in ctx && ctx.user ? ctx.user : null;
  const blocked = Boolean(ctx?.error) || !app;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.72_0.12_295/0.22),transparent_55%),radial-gradient(ellipse_at_bottom,oklch(0.55_0.08_280/0.12),transparent_50%)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            OpenPay Pro Connect
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {app ? `${app.name} wants access` : "Authorization"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review what this app can do with your OpenPay Pro account.
          </p>
        </div>

        <div className="space-y-4 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            {app?.logo_url ? (
              <img
                src={app.logo_url}
                alt=""
                className="h-12 w-12 rounded-2xl border border-border/50 object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
                {(app?.name ?? "A").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{app?.name ?? "Unknown app"}</p>
              {app?.website_url ? (
                <a
                  href={app.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-primary hover:underline"
                >
                  {app.website_url.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {app?.description || "Third-party app"}
                </p>
              )}
            </div>
          </div>

          {user ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/30 px-3 py-2.5">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {(user.display_name || user.username || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {user.display_name || (user.username ? `@${user.username}` : "Signed in")}
                </p>
                {user.username ? (
                  <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Permissions
            </p>
            <ul className="space-y-2">
              {scopes.map((s) => {
                const meta = SCOPE_META[s] ?? {
                  label: s,
                  desc: `Scope: ${s}`,
                  icon: Shield,
                };
                const Icon = meta.icon;
                return (
                  <li
                    key={s}
                    className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background/60 px-3 py-2.5"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.desc}</p>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            disabled={busy || blocked}
            onClick={() => void onApprove()}
            className="h-12 rounded-xl text-base font-bold"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Approve
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={onDeny}
            className="h-12 rounded-xl text-base font-semibold"
          >
            <X className="mr-2 h-4 w-4" />
            Deny
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          You can revoke access anytime in Developer → Connected apps.
        </p>
      </div>
    </main>
  );
}
