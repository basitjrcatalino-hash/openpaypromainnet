import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe · OpenPay Pro" },
      {
        name: "description",
        content:
          "Manage your OpenPay Pro email notifications and unsubscribe from wallet alerts.",
      },
      { property: "og:title", content: "Unsubscribe · OpenPay Pro" },
      {
        property: "og:description",
        content: "Stop receiving OpenPay Pro notification emails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setState("invalid");
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`);
        const json = (await res.json()) as { valid?: boolean; reason?: string };
        if (!res.ok || json.valid === false) {
          setState(json.reason === "already_unsubscribed" ? "already" : "invalid");
          return;
        }
        setState(json.valid ? "valid" : "invalid");
      } catch {
        setState("error");
      }
    })();
  }, []);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          OpenPay Pro
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          {state === "done"
            ? "You're unsubscribed"
            : state === "already"
              ? "Already unsubscribed"
              : state === "invalid"
                ? "Link not valid"
                : state === "error"
                  ? "Something went wrong"
                  : "Unsubscribe from emails"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {state === "loading" && "Checking your link…"}
          {state === "valid" &&
            "Confirm below to stop receiving OpenPay Pro notification emails. Security and sign-in emails will still be delivered."}
          {state === "done" &&
            "You will no longer receive OpenPay Pro notification emails at this address."}
          {state === "already" &&
            "This address is already opted out of OpenPay Pro notification emails."}
          {state === "invalid" &&
            "This unsubscribe link is invalid or has expired. You can manage alerts in Settings inside the app."}
          {state === "error" && "Please try again in a moment."}
        </p>

        {state === "valid" && (
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Unsubscribing…" : "Confirm unsubscribe"}
          </button>
        )}

        <a
          href="/"
          className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to OpenPay Pro
        </a>
      </div>
    </main>
  );
}
