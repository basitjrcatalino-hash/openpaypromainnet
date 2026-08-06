import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
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
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";
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
          "Create OpenPay Pro Connect apps: client ID, client secret, OAuth callback URLs, and Pro Pay charges.",
      },
    ],
  }),
  component: PartnerApiPortalPage,
});

type ProAppRow = Awaited<ReturnType<typeof listProApps>>[number];

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

  const appsQ = useQuery({
    queryKey: ["pro-connect-apps"],
    queryFn: () => listApps(),
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

  const selected = useMemo(
    () => (appsQ.data ?? []).find((a) => a.id === selectedId) ?? (appsQ.data ?? [])[0] ?? null,
    [appsQ.data, selectedId],
  );

  const chargesQ = useQuery({
    queryKey: ["pro-connect-charges", selected?.id],
    queryFn: () => listChargesFn({ data: { id: selected!.id } }),
    enabled: Boolean(selected?.id),
  });

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
      const app = (appsQ.data ?? []).find((a) => a.id === id);
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

  const authorizeSample = selected
    ? `${origin}/pro/authorize?client_id=${encodeURIComponent(selected.client_id)}&redirect_uri=${encodeURIComponent((selected.redirect_uris ?? [])[0] || "https://your.app/callback")}&scope=profile%20balance&state=RANDOM`
    : "";

  const envSample = selected
    ? `PRO_CLIENT_ID="${selected.client_id}"
PRO_CLIENT_SECRET="oprs_live_…"   # shown once at create / rotate
PRO_REDIRECT_URI="${(selected.redirect_uris ?? [])[0] || "https://your.app/callback"}"
PRO_API_BASE="${origin}/api/public/pro"`
    : "";

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
          Partner API
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">OpenPay Pro Connect</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Register your app like the OpenPay Partner portal — get a client ID, set OAuth callback
          URLs, and accept OUSD with Pro Pay. Secrets stay on your server only.
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
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/docs/integrations">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Integration docs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href="/api/public/pro/config" target="_blank" rel="noreferrer">
              Discovery JSON
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/developer">Developer tools</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* App list */}
        <aside className="space-y-2 rounded-3xl border border-border/60 bg-card p-3">
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Your apps
          </p>
          {(appsQ.data ?? []).length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No apps yet. Create one to get credentials.
            </p>
          ) : (
            (appsQ.data ?? []).map((app) => (
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

        {/* Detail */}
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
                    {(selected.redirect_uris ?? []).map((uri) => (
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
                    {(selected.scopes ?? ["profile", "balance", "payments"]).map((s) => (
                      <Badge key={s} variant="secondary" className="rounded-full">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold">Integration quickstart</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Authorize users at <code className="rounded bg-muted px-1">/pro/authorize</code>,
                  exchange codes at{" "}
                  <code className="rounded bg-muted px-1">/api/public/pro/oauth/token</code>, create
                  charges at <code className="rounded bg-muted px-1">/api/public/pro/charges</code>.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Env (server)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full text-xs"
                      onClick={() => copy("Env", envSample)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-2xl border border-border/50 bg-muted/40 p-3 text-[11px] leading-relaxed">
                    <code>{envSample}</code>
                  </pre>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Authorize URL
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full text-xs"
                      onClick={() => copy("Authorize URL", authorizeSample)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-2xl border border-border/50 bg-muted/40 p-3 text-[11px] leading-relaxed break-all">
                    <code>{authorizeSample}</code>
                  </pre>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <QuickLink
                    href="/docs/integrations#auth"
                    title="OAuth Auth"
                    body="Consent → code → oprat_ token"
                  />
                  <QuickLink
                    href="/docs/integrations#charges"
                    title="Pro Pay"
                    body="POST /charges → checkout → poll"
                  />
                  <QuickLink
                    href="/api/public/pro/config"
                    title="Discovery"
                    body="Public endpoint map"
                    external
                  />
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
                    </p>
                  ) : (
                    (chargesQ.data ?? []).map((c) => (
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
        description="Like openpy.space/partner-api — register name, website, and exact callback URLs."
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
              <code className="rounded bg-muted px-1">VITE_</code> env vars.
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
          </div>
        </DialogContent>
      </Dialog>
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
