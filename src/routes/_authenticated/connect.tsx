import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Terminal,
  MessageSquare,
  Plug,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({
    meta: [
      { title: "Connect AI Assistant — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Connect ChatGPT, Claude, or another AI assistant to your OpenPay Pro Wallet via the OpenPay Pro MCP server.",
      },
    ],
  }),
  component: ConnectPage,
});

const APP_NAME = "OpenPay Pro Wallet MAIN";
const APP_SLUG = "openpay-pro-wallet-main";

function useMcpUrl() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return useMemo(() => {
    if (!origin) return "";
    return new URL("/mcp", origin).toString();
  }, [origin]);
}

function useCopyButton(text: string) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!text) return;
    try {
      await copyText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }
  return { copied, copy };
}

function CopyField({ value, label, className }: { value: string; label?: string; className?: string }) {
  const { copied, copy } = useCopyButton(value);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-1.5 pl-3 shadow-sm">
        <code className="min-w-0 flex-1 truncate text-sm font-medium">{value || "Loading…"}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg"
          onClick={copy}
          disabled={!value}
          aria-label="Copy"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {number}
      </span>
      <span className="text-sm leading-relaxed text-foreground">{children}</span>
    </li>
  );
}

function ClientCard({
  icon: Icon,
  name,
  children,
}: {
  icon: React.ElementType;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">{name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function ConnectPage() {
  const mcpUrl = useMcpUrl();

  const claudePrefilledUrl = useMemo(() => {
    if (!mcpUrl) return "";
    const base = "https://claude.ai/customize/connectors";
    const params = new URLSearchParams({
      modal: "add-custom-connector",
      connectorName: APP_NAME,
      connectorUrl: mcpUrl,
    });
    return `${base}?${params.toString()}`;
  }, [mcpUrl]);

  const claudeCodeCommand = useMemo(() => {
    if (!mcpUrl) return "";
    const escapedUrl = mcpUrl.replace(/'/g, "'\\''");
    return `claude mcp add --scope user --transport http ${APP_SLUG} '${escapedUrl}'`;
  }, [mcpUrl]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20 md:pb-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Connect an AI assistant</h1>
        <p className="text-sm text-muted-foreground">
          Use OpenPay Pro Wallet tools inside ChatGPT, Claude, or any MCP client.
        </p>
      </div>


      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-glow">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">MCP server URL</CardTitle>
              <CardDescription>Paste this URL into any MCP client.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CopyField value={mcpUrl} label="Server URL" />
          <p className="mt-3 text-xs text-muted-foreground">
            The URL is generated from the current page address so it stays correct on preview, production, or a custom domain.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Plug className="h-5 w-5 text-primary" /> Connect
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ClientCard icon={MessageSquare} name="ChatGPT">
            <ol className="space-y-3">
              <Step number={1}>
                Open{" "}
                <a
                  href="https://chatgpt.com/#settings/Connectors/Advanced"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                >
                  chatgpt.com/#settings/Connectors/Advanced <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and enable Developer mode if prompted.
              </Step>
              <Step number={2}>Click <strong>Create app</strong> next to the back button.</Step>
              <Step number={3}>Name the app, paste the MCP URL above, and click <strong>Create</strong>.</Step>
              <Step number={4}>Enable the app from the chat composer, then ask ChatGPT to use OpenPay Pro.</Step>
            </ol>
          </ClientCard>

          <ClientCard icon={Bot} name="Claude">
            <ol className="space-y-3">
              <Step number={1}>
                Click{" "}
                <a
                  href={claudePrefilledUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                >
                  this prefilled link <ExternalLink className="h-3 w-3" />
                </a>{" "}
                to open Claude with the name and URL already filled in.
              </Step>
              <Step number={2}>Review the details and click <strong>Add connector</strong>.</Step>
              <Step number={3}>If the prefilled form does not open, go to Claude&apos;s Connectors page, choose <strong>Add custom connector</strong>, and paste the URL.</Step>
              <Step number={4}>Enable the connector from the chat composer, then ask Claude to use OpenPay Pro.</Step>
            </ol>
          </ClientCard>

          <ClientCard icon={Terminal} name="Claude Code">
            <ol className="space-y-3">
              <Step number={1}>Copy the command below and run it in your terminal.</Step>
              <Step number={2}>Start Claude Code and run <code className="rounded bg-muted px-1 py-0.5 text-xs">/mcp</code> to confirm the app is connected.</Step>
              <Step number={3}>Ask Claude Code to use OpenPay Pro.</Step>
            </ol>
            <CopyField value={claudeCodeCommand} label="Install command" className="mt-2" />
          </ClientCard>

          <ClientCard icon={Bot} name="Other MCP clients">
            <ol className="space-y-3">
              <Step number={1}>Open the client&apos;s MCP server or custom connector settings.</Step>
              <Step number={2}>Create a remote MCP server connection.</Step>
              <Step number={3}>Name the connection and paste the MCP URL above.</Step>
              <Step number={4}>Finish any sign-in or authorization prompts, then ask the assistant to use OpenPay Pro.</Step>
            </ol>
          </ClientCard>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <RefreshCw className="h-5 w-5 text-mint" /> Refresh after the app changes
        </h2>
        <p className="text-sm text-muted-foreground">
          Connected assistants cache the tool list. After OpenPay Pro is updated, refresh the connection to get the latest tools.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ChatGPT</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Open the app&apos;s preferences under Enabled apps.</li>
                <li>2. Next to Information, click Refresh.</li>
                <li>3. If the URL changed, paste the latest URL from above.</li>
                <li>4. Start a new chat and ask ChatGPT to use the app.</li>
              </ol>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Claude</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Open the Connectors page and select this connector.</li>
                <li>2. Refresh or update the connector&apos;s tools.</li>
                <li>3. If the URL changed, paste the latest URL from above.</li>
                <li>4. Ask Claude to use the app.</li>
              </ol>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Claude Code</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Start a new Claude Code session to load the latest tools.</li>
                <li>2. If the URL changed, run <code className="rounded bg-muted px-1 py-0.5 text-xs">claude mcp remove {APP_SLUG}</code>, then run the install command again.</li>
                <li>3. Ask Claude Code to use the app.</li>
              </ol>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Other MCP clients</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Open the client&apos;s MCP server or connector settings.</li>
                <li>2. Select the connection created for this app.</li>
                <li>3. Refresh the tool list, reload the server, or reconnect it.</li>
                <li>4. Start a new chat or session and ask the assistant to use the app.</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex justify-start pt-2">
        <Button asChild variant="outline" className="gap-2 rounded-full">
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}
