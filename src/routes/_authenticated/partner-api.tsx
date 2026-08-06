import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";
import { getDeveloperPortalProfile } from "@/lib/developer.functions";
import {
  createProApp,
  deleteProApp,
  listProAppCharges,
  listProApps,
  rotateProAppSecret,
  updateProApp,
} from "@/lib/pro-connect.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/partner-api")({
  head: () => ({
    meta: [
      { title: "Partner API — OpenPay Pro Connect" },
      {
        name: "description",
        content:
          "Beginner-friendly OpenPay Pro Partner API: create apps, copy env, OAuth auth, Pro Pay checkout, and receive OUSD to your wallet.",
      },
    ],
  }),
  component: PartnerApiPortalPage,
});

/** Explicit row shape — useServerFn return is often untyped in the client bundle. */
type ProAppRow = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  client_id: string;
  secret_prefix: string;
  redirect_uris: string[];
  scopes: string[];
  active: boolean;
  created_at: string;
};

type ProChargeRow = {
  id: string;
  amount: number | string;
  currency: string;
  description: string | null;
  reference: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
};

function copy(label: string, value: string) {
  void copyText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Copy failed"),
  );
}

function parseRedirectUris(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function PartnerApiPortalPage() {
  const qc = useQueryClient();
  const listApps = useServerFn(listProApps);
  const createAppFn = useServerFn(createProApp);
  const updateAppFn = useServerFn(updateProApp);
  const rotateSecretFn = useServerFn(rotateProAppSecret);
  const deleteAppFn = useServerFn(deleteProApp);
  const listChargesFn = useServerFn(listProAppCharges);
  const getProfile = useServerFn(getDeveloperPortalProfile);

  const appsQ = useQuery({
    queryKey: ["pro-connect-apps"],
    queryFn: async () => (await listApps()) as ProAppRow[],
  });
  const profileQ = useQuery({
    queryKey: ["developer-portal-profile"],
    queryFn: () => getProfile(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [redirects, setRedirects] = useState("http://localhost:3000/callback");

  const [plainSecret, setPlainSecret] = useState<{
    client_id: string;
    client_secret: string;
  } | null>(null);
  const [setupStep, setSetupStep] = useState(1);

  const apps = useMemo(() => appsQ.data ?? [], [appsQ.data]);
  const selected = useMemo(
    () => apps.find((a: ProAppRow) => a.id === selectedId) ?? apps[0] ?? null,
    [apps, selectedId],
  );

  const chargesQ = useQuery({
    queryKey: ["pro-connect-charges", selected?.id],
    queryFn: async () => (await listChargesFn({ data: { id: selected!.id } })) as ProChargeRow[],
    enabled: Boolean(selected?.id),
  });

  const wallet = profileQ.data?.activeWallet;
  const username = profileQ.data?.username;
  const walletAddress = wallet?.address ?? "";
  const receiveHandle = useMemo(() => {
    if (walletAddress) return walletAddress;
    if (username) return `@${username.replace(/^@+/, "")}`;
    if (profileQ.data?.userId) return `uid_${profileQ.data.userId}`;
    return "";
  }, [walletAddress, username, profileQ.data?.userId]);

  function resetForm(app?: ProAppRow | null) {
    setName(app?.name ?? "");
    setDescription(app?.description ?? "");
    setWebsiteUrl(app?.website_url ?? "");
    setLogoUrl(app?.logo_url ?? "");
    setRedirects((app?.redirect_uris ?? ["http://localhost:3000/callback"]).join("\n"));
  }

  const createApp = useMutation({
    mutationFn: () =>
      createAppFn({
        data: {
          name: name.trim() || "My app",
          description: description.trim() || null,
          website_url: websiteUrl.trim() || null,
          logo_url: logoUrl.trim() || null,
          redirect_uris: parseRedirectUris(redirects),
        },
      }),
    onSuccess: (res) => {
      setPlainSecret({ client_id: res.app.client_id, client_secret: res.client_secret });
      setCreateOpen(false);
      resetForm();
      setSelectedId(res.app.id);
      setSetupStep(2);
      void qc.invalidateQueries({ queryKey: ["pro-connect-apps"] });
      toast.success("App created — copy your client secret now");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveApp = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No app selected");
      return updateAppFn({
        data: {
          id: selected.id,
          name: name.trim() || selected.name,
          description: description.trim() || null,
          website_url: websiteUrl.trim() || null,
          logo_url: logoUrl.trim() || null,
          redirect_uris: parseRedirectUris(redirects),
        },
      });
    },
    onSuccess: () => {
      setEditOpen(false);
      void qc.invalidateQueries({ queryKey: ["pro-connect-apps"] });
      toast.success("App updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotateSecret = useMutation({
    mutationFn: (id: string) => rotateSecretFn({ data: { id } }),
    onSuccess: (res, id) => {
      const app = apps.find((a: ProAppRow) => a.id === id);
      setPlainSecret({
        client_id: app?.client_id ?? "",
        client_secret: res.client_secret,
      });
      void qc.invalidateQueries({ queryKey: ["pro-connect-apps"] });
      toast.success("Secret rotated — copy it now");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (app: ProAppRow) => updateAppFn({ data: { id: app.id, active: !app.active } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pro-connect-apps"] });
      toast.success("App status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteApp = useMutation({
    mutationFn: (id: string) => deleteAppFn({ data: { id } }),
    onSuccess: () => {
      setSelectedId(null);
      void qc.invalidateQueries({ queryKey: ["pro-connect-apps"] });
      toast.success("App deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://openpaypro.space";
  const redirect0 = (selected?.redirect_uris ?? [])[0] || "https://your.app/callback";

  const authorizeSample = selected
    ? `${origin}/pro/authorize?client_id=${encodeURIComponent(selected.client_id)}&redirect_uri=${encodeURIComponent(redirect0)}&scope=profile%20balance%20payments&state=RANDOM`
    : "";

  const clientId = selected?.client_id ?? "opro_live_YOUR_CLIENT_ID";
  const secretPlaceholder = plainSecret?.client_secret ?? "oprs_live_PASTE_SECRET_SHOWN_ONCE";

  const envSample = selected
    ? `# OpenPay Pro Connect — SERVER ONLY (never VITE_ / public)
PRO_CLIENT_ID="${selected.client_id}"
PRO_CLIENT_SECRET="${secretPlaceholder}"
PRO_REDIRECT_URI="${redirect0}"
PRO_API_BASE="${origin}/api/public/pro"
# Your merchant wallet — Pro Pay credits land here
PRO_RECEIVE_WALLET="${walletAddress || "0x…"}"
PRO_RECEIVE_HANDLE="${receiveHandle || "@you"}"`
    : "";

  const chargeCurl = selected
    ? `curl -X POST "${origin}/api/public/pro/charges" \\
  -u "${selected.client_id}:YOUR_CLIENT_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 12.50,
    "description": "Order #1001",
    "reference": "ord_1001",
    "success_url": "https://your.app/paid",
    "cancel_url": "https://your.app/cancel"
  }'`
    : "";

  const authCode = selected
    ? `// Step A — Sign in with OpenPay Pro (browser)
const state = crypto.randomUUID();
sessionStorage.setItem("op_pro_state", state);
const url = new URL("${origin}/pro/authorize");
url.searchParams.set("client_id", process.env.PRO_CLIENT_ID!);
url.searchParams.set("redirect_uri", process.env.PRO_REDIRECT_URI!);
url.searchParams.set("scope", "profile balance payments");
url.searchParams.set("state", state);
window.location.href = url.toString();

// Step B — Callback route (server): exchange code → oprat_
export async function exchangeProCode(code: string, redirectUri: string) {
  const basic = Buffer.from(
    \`\${process.env.PRO_CLIENT_ID}:\${process.env.PRO_CLIENT_SECRET}\`,
  ).toString("base64");
  const res = await fetch(\`\${process.env.PRO_API_BASE}/oauth/token\`, {
    method: "POST",
    headers: {
      Authorization: \`Basic \${basic}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { access_token: "oprat_…", user_id, … }
}`
    : "";

  const payCode = selected
    ? `// Step C — Create charge + redirect to checkout (server)
export async function createProCharge(opts: {
  amount: number;
  description?: string;
  reference?: string;
  success_url: string;
  cancel_url: string;
}) {
  const basic = Buffer.from(
    \`\${process.env.PRO_CLIENT_ID}:\${process.env.PRO_CLIENT_SECRET}\`,
  ).toString("base64");
  const res = await fetch(\`\${process.env.PRO_API_BASE}/charges\`, {
    method: "POST",
    headers: {
      Authorization: \`Basic \${basic}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currency: "OUSD", ...opts }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, checkout_url, status, … }
}

// Step D — Poll until paid | canceled | expired (no webhooks)
export async function pollProCharge(id: string) {
  const basic = Buffer.from(
    \`\${process.env.PRO_CLIENT_ID}:\${process.env.PRO_CLIENT_SECRET}\`,
  ).toString("base64");
  for (let i = 0; i < 60; i++) {
    const res = await fetch(\`\${process.env.PRO_API_BASE}/charges/\${id}\`, {
      headers: { Authorization: \`Basic \${basic}\` },
    });
    const charge = await res.json();
    if (["paid", "canceled", "expired"].includes(charge.status)) return charge;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timed out waiting for payment");
}`
    : "";

  const fullStackPaste = selected
    ? `${envSample}

# --- Auth redirect ---
${authorizeSample}

# --- Node helpers (paste into your server) ---
${authCode}

${payCode}`
    : "";

  const cursorPrompt = selected
    ? `Integrate OpenPay Pro Connect into this project — full beginner setup.

## 1) Add server env (never VITE_ / browser)
PRO_CLIENT_ID=${selected.client_id}
PRO_CLIENT_SECRET=<paste secret from Partner API — shown once at create/rotate>
PRO_REDIRECT_URI=${redirect0}
PRO_API_BASE=${origin}/api/public/pro

## 2) Merchant receive wallet (paid OUSD lands here)
Address: ${walletAddress || "(create wallet in OpenPay Pro first)"}
Handle: ${receiveHandle || "@you"}

## 3) Fetch docs first
- ${origin}/api/public/docs/integrations
- ${origin}/api/public/pro/config
- ${origin}/docs/integrations

## 4) Build UI + server
A) "Sign in with OpenPay Pro" button → redirect:
   ${origin}/pro/authorize?client_id=${encodeURIComponent(selected.client_id)}&redirect_uri=${encodeURIComponent(redirect0)}&scope=profile%20balance%20payments&state=RANDOM
B) Callback: POST ${origin}/api/public/pro/oauth/token
   Basic auth (client_id:client_secret) + { grant_type, code, redirect_uri }
   Store access_token (oprat_…) server-side only
C) Checkout: POST ${origin}/api/public/pro/charges → redirect checkout_url
D) Poll GET ${origin}/api/public/pro/charges/{id} until paid|canceled|expired
E) Optional: GET /user/me and /user/balance with Bearer oprat_

## Rules
- Exact-match redirect_uri · currency OUSD · no charge webhooks · secrets server-only
- Paid funds credit app owner Pro wallet ${walletAddress || "0x…"}

Ship working Auth + Pay pages with copy-pasteable env and error toasts.`
    : "";

  const lovablePrompt = selected
    ? `@${origin}/api/public/docs/integrations
@${origin}/llms.txt
@${origin}/api/public/pro/config

Build a complete OpenPay Pro Connect integration (beginner-friendly).

## Env (server secrets only — NEVER VITE_)
PRO_CLIENT_ID=${selected.client_id}
PRO_CLIENT_SECRET=<paste from Partner API portal>
PRO_REDIRECT_URI=${redirect0}
PRO_API_BASE=${origin}/api/public/pro

## Pages to create
1) Home with two buttons:
   - "Sign in with OpenPay Pro" → ${origin}/pro/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect0)}&scope=profile%20balance%20payments&state=…
   - "Pay with OpenPay Pro" → server creates charge → redirect checkout_url
2) /callback — read ?code&state → exchange token at POST /api/public/pro/oauth/token (Basic auth)
3) /paid — poll GET /charges/:id until paid|canceled|expired

## Merchant wallet (you get paid here)
${walletAddress || "0x…"} (${receiveHandle || "@you"})

No webhooks. Exact redirect_uri. Currency OUSD. Keep secrets on server.`
    : "";

  const replitPrompt = selected
    ? `Use OpenPay Pro Connect API.

Base: ${origin}/api/public/pro
Docs: ${origin}/api/public/docs/integrations

Secrets (.env — not public):
PRO_CLIENT_ID=${selected.client_id}
PRO_CLIENT_SECRET=…
PRO_REDIRECT_URI=${redirect0}
PRO_API_BASE=${origin}/api/public/pro

Implement:
1) Auth: redirect /pro/authorize → exchange code → oprat_
2) Pay: POST /charges → checkout_url → poll
Paid OUSD → merchant wallet ${walletAddress || "0x…"}
No webhooks. Exact redirect_uri match.`
    : "";

  const chatgptPrompt = selected
    ? `You are integrating OpenPay Pro Connect for a beginner.

Read: ${origin}/api/public/docs/integrations
Discovery: ${origin}/api/public/pro/config

My credentials (server only):
PRO_CLIENT_ID=${selected.client_id}
PRO_CLIENT_SECRET=<I will paste secret>
PRO_REDIRECT_URI=${redirect0}
PRO_API_BASE=${origin}/api/public/pro
Receive wallet: ${walletAddress || "0x…"}

Generate step-by-step:
1) .env file
2) Sign-in button + OAuth callback (token exchange)
3) Create charge + redirect + poller
4) How I confirm payment landed in my Pro wallet

Rules: OUSD, poll charges (no webhooks), never expose secret to browser.`
    : "";

  const SETUP_STEPS = [
    { n: 1, title: "Create app", blurb: "Name + callback URL" },
    { n: 2, title: "Copy env", blurb: "Paste PRO_* secrets" },
    { n: 3, title: "AI paste", blurb: "Cursor · Lovable · Replit" },
    { n: 4, title: "App code", blurb: "Auth + Pay snippets" },
    { n: 5, title: "Get paid", blurb: "Your Pro wallet" },
  ] as const;

  if (appsQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full">
          Partner API · Easy setup
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Connect any app in minutes
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Follow the 5-step copy-paste setup: create app → copy env → paste a Cursor / Lovable /
          Replit prompt (or Auth + Pay code). Payments credit{" "}
          <strong className="text-foreground">your</strong> OpenPay Pro wallet.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            className="rounded-full"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create app
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setSetupStep(1);
              document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Start setup guide
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/docs/integrations">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Full docs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/docs/ai">
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              AI Partner Pack
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href="/api/public/pro/config" target="_blank" rel="noreferrer">
              Discovery JSON
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Full copy-paste setup wizard */}
      <section id="setup" className="space-y-4 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Full Partner API setup
            </p>
            <h2 className="mt-1 text-lg font-bold">Copy & paste — step by step</h2>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Follow each step in order. Copy env into your app, then paste a Cursor / Lovable /
              Replit prompt — or drop the Auth + Pay code yourself.
            </p>
          </div>
          {selected ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => copy("Full setup pack", fullStackPaste)}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy everything
            </Button>
          ) : null}
        </div>

        <ol className="grid gap-2 sm:grid-cols-5">
          {SETUP_STEPS.map((s) => (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => setSetupStep(s.n)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-2xl border px-3 py-2.5 text-left transition",
                  setupStep === s.n
                    ? "border-primary/40 bg-primary/10 ring-1 ring-primary/25"
                    : "border-border/40 bg-muted/15 hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                    setupStep === s.n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{s.title}</span>
                  <span className="block text-[10px] text-muted-foreground">{s.blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 sm:p-5">
          {setupStep === 1 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Step 1 — Create your Connect app</h3>
              <p className="text-xs text-muted-foreground">
                Add your app name and the <strong className="text-foreground">exact</strong> OAuth
                callback URL your site will use (example:{" "}
                <code className="rounded bg-muted px-1">https://your.app/callback</code>). You’ll
                get a <code className="rounded bg-muted px-1">opro_live_</code> client ID and a
                one-time <code className="rounded bg-muted px-1">oprs_live_</code> secret.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  Local testing: add{" "}
                  <code className="rounded bg-muted px-1">http://localhost:3000/callback</code>
                </li>
                <li>Copy the secret immediately — it is only shown once</li>
                <li>
                  Never put the secret in <code className="rounded bg-muted px-1">VITE_</code> env
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  className="rounded-full"
                  onClick={() => {
                    resetForm();
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {selected ? "Create another app" : "Create app now"}
                </Button>
                {selected ? (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setSetupStep(2)}
                  >
                    Next: copy env
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {setupStep === 2 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Step 2 — Copy env into your app</h3>
              {!selected ? (
                <p className="text-xs text-muted-foreground">
                  Create an app first (Step 1), then come back to copy live credentials.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Paste into your server <code className="rounded bg-muted px-1">.env</code> /
                    secrets. Replace the secret with the value from create/rotate. After env is set,
                    go to Step 3 (AI) or Step 4 (manual code).
                  </p>
                  {plainSecret ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                      Fresh secret is in the dialog — also filled into the env block below for this
                      session.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                      Secret not in memory. Use <strong className="text-foreground">Rotate</strong>{" "}
                      on the app card if you need a new one, or paste the secret you saved earlier.
                    </div>
                  )}
                  <CodeBlock
                    label=".env (server)"
                    value={envSample}
                    onCopy={() => copy("Env", envSample)}
                  />
                  <CodeBlock
                    label="Authorize URL (test in browser)"
                    value={authorizeSample}
                    onCopy={() => copy("Authorize URL", authorizeSample)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setSetupStep(1)}
                    >
                      Back
                    </Button>
                    <Button className="rounded-full" onClick={() => setSetupStep(3)}>
                      Next: AI paste
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {setupStep === 3 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Step 3 — Paste into Cursor · Lovable · Replit</h3>
              {!selected ? (
                <p className="text-xs text-muted-foreground">
                  Create an app first to unlock live prompts.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Pick your tool → <strong className="text-foreground">Copy</strong> → paste into
                    the AI chat. It will wire Auth, checkout, env, and your receive wallet.
                  </p>
                  <Tabs defaultValue="cursor" className="w-full">
                    <TabsList className="mb-3 flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/40 p-1">
                      <TabsTrigger value="cursor" className="rounded-xl text-xs">
                        Cursor
                      </TabsTrigger>
                      <TabsTrigger value="lovable" className="rounded-xl text-xs">
                        Lovable
                      </TabsTrigger>
                      <TabsTrigger value="replit" className="rounded-xl text-xs">
                        Replit
                      </TabsTrigger>
                      <TabsTrigger value="chatgpt" className="rounded-xl text-xs">
                        ChatGPT
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="cursor" className="mt-0 space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Paste in Cursor Agent / Composer. Best for existing repos.
                      </p>
                      <CodeBlock
                        label="Cursor / Claude prompt"
                        value={cursorPrompt}
                        onCopy={() => copy("Cursor prompt", cursorPrompt)}
                      />
                    </TabsContent>
                    <TabsContent value="lovable" className="mt-0 space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Paste in Lovable chat. Keep secrets in server secrets — not{" "}
                        <code className="rounded bg-muted px-1">VITE_</code>.
                      </p>
                      <CodeBlock
                        label="Lovable prompt"
                        value={lovablePrompt}
                        onCopy={() => copy("Lovable prompt", lovablePrompt)}
                      />
                    </TabsContent>
                    <TabsContent value="replit" className="mt-0 space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Paste in Replit AI / Agent. Add Secrets in the Replit Secrets panel.
                      </p>
                      <CodeBlock
                        label="Replit prompt"
                        value={replitPrompt}
                        onCopy={() => copy("Replit prompt", replitPrompt)}
                      />
                    </TabsContent>
                    <TabsContent value="chatgpt" className="mt-0 space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Paste in ChatGPT / Claude Projects with your stack described.
                      </p>
                      <CodeBlock
                        label="ChatGPT prompt"
                        value={chatgptPrompt}
                        onCopy={() => copy("ChatGPT prompt", chatgptPrompt)}
                      />
                    </TabsContent>
                  </Tabs>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setSetupStep(2)}
                    >
                      Back
                    </Button>
                    <Button className="rounded-full" onClick={() => setSetupStep(4)}>
                      Or paste code yourself
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="rounded-full">
                      <Link to="/docs/ai">More AI prompts</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {setupStep === 4 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Step 4 — Copy Auth + Pay app code</h3>
              {!selected ? (
                <p className="text-xs text-muted-foreground">Create an app first.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Prefer hand-wiring? Copy these Node snippets into your server. Flow: authorize →
                    token → create charge → poll.
                  </p>
                  <CodeBlock
                    label="Auth (redirect + token exchange)"
                    value={authCode}
                    onCopy={() => copy("Auth code", authCode)}
                  />
                  <CodeBlock
                    label="Pay (create charge + poll)"
                    value={payCode}
                    onCopy={() => copy("Pay code", payCode)}
                  />
                  <CodeBlock
                    label="Create charge (cURL test)"
                    value={chargeCurl}
                    onCopy={() => copy("cURL", chargeCurl)}
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <QuickLink
                      href="/docs/integrations#auth"
                      title="Docs: Auth"
                      body="Consent → code → oprat_"
                    />
                    <QuickLink
                      href="/docs/integrations#charges"
                      title="Docs: Pro Pay"
                      body="POST /charges → poll"
                    />
                    <QuickLink
                      href="/api/public/pro/config"
                      title="Discovery JSON"
                      body="Endpoint map"
                      external
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setSetupStep(3)}
                    >
                      Back
                    </Button>
                    <Button className="rounded-full" onClick={() => setSetupStep(5)}>
                      Next: get paid
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {setupStep === 5 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Step 5 — Confirm payments land in your wallet</h3>
              <p className="text-xs text-muted-foreground">
                When a buyer pays a Pro Pay charge for your app, OUSD credits{" "}
                <strong className="text-foreground">your</strong> OpenPay Pro wallet below. Check
                Recent charges on this page after a test payment.
              </p>
              {!walletAddress ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">No wallet yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a wallet first so Pro Pay knows where to credit you.
                  </p>
                  <Button asChild size="sm" className="mt-3 rounded-full">
                    <Link to="/settings">Open Settings</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <FieldRow
                    label="Wallet address"
                    value={walletAddress}
                    onCopy={() => copy("Wallet address", walletAddress)}
                  />
                  <FieldRow
                    label="Receive handle"
                    value={receiveHandle}
                    onCopy={() => copy("Handle", receiveHandle)}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/receive">Open Receive</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <a href="/docs/integrations#charges">How Pro Pay credits you</a>
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => setSetupStep(1)}>
                  Restart setup
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Receive wallet summary (always visible) */}
      <section className="space-y-3 rounded-3xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Your receive wallet (where payments land)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Pro Pay for your Connect apps credits this OpenPay Pro wallet. Same address as Step 5.
        </p>
        {!walletAddress ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">No wallet yet</p>
            <Button asChild size="sm" className="mt-3 rounded-full">
              <Link to="/settings">Open Settings</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <FieldRow
              label="Wallet address"
              value={walletAddress}
              onCopy={() => copy("Wallet address", walletAddress)}
            />
            <FieldRow
              label="Receive handle"
              value={receiveHandle}
              onCopy={() => copy("Handle", receiveHandle)}
            />
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <aside className="space-y-2 rounded-3xl border border-border/60 bg-card p-3">
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Your apps
          </p>
          {apps.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No apps yet. Create one to get credentials.
            </p>
          ) : (
            apps.map((app: ProAppRow) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedId(app.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition",
                  selected?.id === app.id
                    ? "bg-primary/12 ring-1 ring-primary/30"
                    : "hover:bg-muted/50",
                )}
              >
                {app.logo_url ? (
                  <img
                    src={app.logo_url}
                    alt=""
                    className="mt-0.5 h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                    {app.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{app.name}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {app.client_id.slice(0, 18)}…
                  </span>
                </span>
                <Badge
                  variant={app.active ? "secondary" : "outline"}
                  className={cn("rounded-full text-[10px]", !app.active && "opacity-60")}
                >
                  {app.active ? "On" : "Off"}
                </Badge>
              </button>
            ))
          )}
        </aside>

        <div className="space-y-4">
          {!selected ? (
            <section className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-8 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-3 text-lg font-bold">Create your first Connect app</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Enter app name, website, and exact OAuth callback URLs. You’ll receive{" "}
                <code className="rounded bg-muted px-1">opro_live_</code> client ID and{" "}
                <code className="rounded bg-muted px-1">oprs_live_</code> secret.
              </p>
              <Button
                className="mt-4 rounded-full"
                onClick={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create app
              </Button>
            </section>
          ) : (
            <>
              <section className="space-y-4 rounded-3xl border border-border/60 bg-card p-5">
                <div className="flex flex-wrap items-start gap-3">
                  {selected.logo_url ? (
                    <img
                      src={selected.logo_url}
                      alt=""
                      className="h-12 w-12 rounded-2xl border border-border/50 object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
                      {selected.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selected.description || "No description"}
                      {selected.website_url
                        ? ` · ${selected.website_url.replace(/^https?:\/\//, "")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        resetForm(selected);
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(selected)}
                    >
                      {selected.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-destructive"
                      disabled={deleteApp.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete ${selected.name}? This cannot be undone.`)) {
                          deleteApp.mutate(selected.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <FieldRow
                    label="Client ID"
                    value={selected.client_id}
                    onCopy={() => copy("Client ID", selected.client_id)}
                  />
                  <FieldRow
                    label="Client secret"
                    value={`${selected.secret_prefix}…`}
                    hint="Full secret shown once at create / rotate"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={rotateSecret.isPending}
                        onClick={() => rotateSecret.mutate(selected.id)}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Rotate
                      </Button>
                    }
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    OAuth callback / redirect URIs
                  </p>
                  <ul className="space-y-1.5">
                    {(selected.redirect_uris ?? []).map((uri: string) => (
                      <li
                        key={uri}
                        className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 font-mono text-[12px]"
                      >
                        <span className="min-w-0 flex-1 break-all">{uri}</span>
                        <button
                          type="button"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                          onClick={() => copy("Redirect URI", uri)}
                          aria-label="Copy redirect URI"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Exact match required (trailing slash trimmed). Same rule as OpenPay Partner
                    portal.
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Scopes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.scopes ?? ["profile", "balance", "payments"]).map((s: string) => (
                      <Badge key={s} variant="secondary" className="rounded-full">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-bold">Ready to integrate?</h3>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setSetupStep(2);
                      document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Open copy-paste setup
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the <strong className="text-foreground">5-step wizard</strong> above: copy env
                  → paste Cursor / Lovable / Replit prompt → or drop Auth + Pay code. Paid OUSD
                  credits your receive wallet.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setSetupStep(3);
                      document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <Bot className="mr-1.5 h-3.5 w-3.5" />
                    AI prompts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setSetupStep(4);
                      document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    App code
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => copy("Env", envSample)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy env
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold">Recent charges</h3>
                </div>
                <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50">
                  {(chargesQ.data ?? []).length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No charges yet. Create one via{" "}
                      <code className="rounded bg-muted px-1">POST /api/public/pro/charges</code>.
                      Paid amounts credit your wallet address.
                    </p>
                  ) : (
                    (chargesQ.data ?? []).map((c: ProChargeRow) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tabular-nums">
                            {Number(c.amount).toFixed(2)} {c.currency}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {c.description || c.reference || c.id}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {c.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <AppFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Connect app"
        description="Name your app and add exact OAuth callback URLs — same idea as openpy.space/partner-api."
        name={name}
        setName={setName}
        descriptionValue={description}
        setDescription={setDescription}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        redirects={redirects}
        setRedirects={setRedirects}
        busy={createApp.isPending}
        submitLabel="Create app"
        onSubmit={() => createApp.mutate()}
      />

      <AppFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit app"
        description="Update branding and OAuth redirect URIs. Client ID never changes."
        name={name}
        setName={setName}
        descriptionValue={description}
        setDescription={setDescription}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        redirects={redirects}
        setRedirects={setRedirects}
        busy={saveApp.isPending}
        submitLabel="Save changes"
        onSubmit={() => saveApp.mutate()}
      />

      <Dialog open={!!plainSecret} onOpenChange={(o) => !o && setPlainSecret(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Copy your credentials</DialogTitle>
            <DialogDescription>
              The client secret is shown once. Store it in server secrets — never in{" "}
              <code className="rounded bg-muted px-1">VITE_</code> env vars. Then continue the
              copy-paste setup (env → AI prompt).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Client ID</p>
              <p className="break-all font-mono text-xs">{plainSecret?.client_id}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Client secret</p>
              <p className="break-all font-mono text-xs">{plainSecret?.client_secret}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              variant="outline"
              onClick={() => {
                if (plainSecret) copy("Client ID", plainSecret.client_id);
              }}
            >
              Copy client id
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                if (plainSecret) copy("Client secret", plainSecret.client_secret);
              }}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Copy secret
            </Button>
            <Button
              className="rounded-full"
              variant="secondary"
              onClick={() => {
                setPlainSecret(null);
                setSetupStep(2);
                requestAnimationFrame(() =>
                  document.getElementById("setup")?.scrollIntoView({ behavior: "smooth" }),
                );
              }}
            >
              Continue setup
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeBlock({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={onCopy}>
          <Copy className="mr-1 h-3 w-3" />
          Copy
        </Button>
      </div>
      <pre className="max-h-56 overflow-auto rounded-2xl border border-border/50 bg-muted/40 p-3 text-[11px] leading-relaxed break-all whitespace-pre-wrap">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function AppFormDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  setName,
  descriptionValue,
  setDescription,
  websiteUrl,
  setWebsiteUrl,
  logoUrl,
  setLogoUrl,
  redirects,
  setRedirects,
  busy,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  name: string;
  setName: (v: string) => void;
  descriptionValue: string;
  setDescription: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  logoUrl: string;
  setLogoUrl: (v: string) => void;
  redirects: string;
  setRedirects: (v: string) => void;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="app-name">App name</Label>
            <Input
              id="app-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Checkout"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-desc">Description</Label>
            <Input
              id="app-desc"
              value={descriptionValue}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short blurb shown on consent"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-web">Website URL</Label>
            <Input
              id="app-web"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://your.app"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-logo">Logo URL</Label>
            <Input
              id="app-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://your.app/logo.png"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-redirects">OAuth callback / redirect URIs</Label>
            <Textarea
              id="app-redirects"
              value={redirects}
              onChange={(e) => setRedirects(e.target.value)}
              placeholder={"https://your.app/callback\nhttp://localhost:3000/callback"}
              className="min-h-24 rounded-xl font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              One URI per line. Must match exactly on authorize / token exchange.
            </p>
          </div>
          <Button
            className="h-11 w-full rounded-xl font-bold"
            disabled={busy || !name.trim() || !parseRedirectUris(redirects).length}
            onClick={onSubmit}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label,
  value,
  hint,
  onCopy,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  onCopy?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="break-all font-mono text-[12px] font-semibold">{value || "—"}</p>
          {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
        </div>
        {onCopy && value ? (
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function QuickLink({
  href,
  title,
  body,
  external,
}: {
  href: string;
  title: string;
  body: string;
  external?: boolean;
}) {
  const className =
    "rounded-2xl border border-border/50 bg-muted/20 px-3 py-3 transition hover:border-primary/40 hover:bg-muted/40";
  const inner = (
    <>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{body}</p>
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <a href={href} className={className}>
      {inner}
    </a>
  );
}
