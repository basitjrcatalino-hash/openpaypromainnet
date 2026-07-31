/**
 * Server-side transaction alerts — Web Push + email (Resend) for every wallet transaction.
 *
 * Env: RESEND_API_KEY, RESEND_FROM_EMAIL, APP_URL
 * Optional catch-all: Supabase trigger / DB webhook → /api/webhooks/transactions + TX_WEBHOOK_SECRET
 */
// @ts-expect-error - web-push ships no type declarations
import webpush from "web-push";

type TxLike = {
  id?: string;
  type?: string;
  token_symbol?: string | null;
  amount?: number | string | null;
  memo?: string | null;
  counterparty?: string | null;
  status?: string | null;
  created_at?: string | null;
  wallet_id?: string;
};

function vapidConfigured() {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim() || process.env.VITE_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@openpy.space";
  return pub && priv ? { pub, priv, subject } : null;
}

function appBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.VITE_APP_URL?.trim() ||
    "https://openpaypro.space"
  ).replace(/\/$/, "");
}

function formatAlert(tx: TxLike): {
  title: string;
  body: string;
  url: string;
  kind: "receive" | "send" | "other";
  amountLabel: string;
  symbol: string;
} {
  const symbol = String(tx.token_symbol ?? "token").replace(/^\$/, "");
  const type = String(tx.type ?? "activity");
  const amount = Number(tx.amount ?? 0);
  const isReceive = type === "receive" || type === "buy" || type === "reward" || type === "deposit";
  const isSend = type === "send" || type === "sell";
  const signed =
    Number.isFinite(amount) && amount !== 0
      ? `${isReceive && amount > 0 ? "+" : ""}${amount} ${symbol}`
      : symbol;

  const title = isReceive
    ? `You received ${symbol}`
    : isSend
      ? `You sent ${symbol}`
      : type === "swap"
        ? `Swapped ${symbol}`
        : type === "mint"
          ? `Minted ${symbol}`
          : `OpenPay Pro · ${type}`;

  const body =
    tx.memo?.trim() ||
    (tx.counterparty
      ? `${signed} · ${String(tx.counterparty).slice(0, 28)}`
      : `${signed} · ${tx.status ?? "confirmed"}`);

  return {
    title,
    body,
    url: "/activity",
    kind: isReceive ? "receive" : isSend ? "send" : "other",
    amountLabel: signed,
    symbol,
  };
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return /@(pi|telegram|solana|walletconnect|privy|openpay)\.|@openpay\.(local|auth|wallet)|\.local$/i.test(
    email,
  );
}

function looksLikeEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const e = value.trim();
  return e.includes("@") && e.length >= 5 && e.length <= 254 && !isSyntheticEmail(e);
}

type AdminClient = {
  from: (table: string) => any;
  auth: {
    admin: {
      getUserById: (
        id: string,
      ) => Promise<{
        data: {
          user?: {
            email?: string | null;
            user_metadata?: Record<string, unknown> | null;
          } | null;
        };
      }>;
    };
  };
};

/** Skip platform fee / treasury ledger noise — users only. */
function isInternalFeeTx(tx: TxLike): boolean {
  const c = String(tx.counterparty ?? "").toLowerCase();
  const m = String(tx.memo ?? "").toLowerCase();
  return (
    c.startsWith("platform_fee") ||
    c.startsWith("topup_fee:") ||
    c === "platform_fee" ||
    m.includes("platform mint fee") ||
    m.includes("top-up fee ·") ||
    m.startsWith("platform trade fee")
  );
}

export async function notifyWalletTransaction(
  admin: AdminClient,
  walletId: string,
  tx: TxLike,
): Promise<void> {
  try {
    if (!walletId) return;
    if (isInternalFeeTx(tx)) return;

    const { data: wallet } = await admin
      .from("wallets")
      .select("user_id, address")
      .eq("id", walletId)
      .maybeSingle();
    const userId = wallet?.user_id as string | undefined;
    if (!userId) return;

    // Don't email the platform treasury wallet for fee credits
    const addr = String(wallet?.address ?? "").toLowerCase();
    if (addr === "0xc847682465ea537c3957cd46eff2c7229faefde1") return;

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();

    const n = (prefs?.notifications ?? {}) as Record<string, unknown>;
    const txAlerts = n.tx_alerts !== false;
    if (!txAlerts) return;

    const pushOn = n.browser_push === true;
    const emailOn = n.email_alerts !== false; // default on when preference unset
    const alert = formatAlert(tx);

    if (pushOn) {
      await sendWebPushToUser(admin, userId, {
        title: alert.title,
        body: alert.body,
        url: alert.url,
        txId: tx.id,
        tag: tx.id || "openpay-tx",
      });
    }

    if (emailOn) {
      await sendTxEmail(admin, userId, alert, tx, n);
    }
  } catch (err) {
    console.error("[tx-alerts]", err);
  }
}

async function sendWebPushToUser(
  admin: AdminClient,
  userId: string,
  payload: { title: string; body: string; url: string; txId?: string; tag?: string },
) {
  const vapid = vapidConfigured();
  if (!vapid) return;

  webpush.setVapidDetails(vapid.subject, vapid.pub, vapid.priv);

  const { data: rows } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!rows?.length) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    txId: payload.txId,
    tag: payload.tag,
    icon: "/ousd-logo.svg",
  });

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
        { TTL: 60 * 60 },
      );
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", row.id);
      } else {
        console.warn("[tx-alerts] push failed", status || err);
      }
    }
  }
}

async function resolveRecipientEmail(
  admin: AdminClient,
  userId: string,
  notifications: Record<string, unknown>,
): Promise<string | null> {
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const user = userData?.user;
  const candidates: unknown[] = [
    user?.email,
    user?.user_metadata?.email,
    user?.user_metadata?.preferred_email,
    user?.user_metadata?.contact_email,
    (notifications.openpay as { email?: string } | undefined)?.email,
    notifications.alert_email,
    notifications.email,
  ];

  for (const c of candidates) {
    if (looksLikeEmail(c)) return String(c).trim().toLowerCase();
  }
  return null;
}

async function alreadySentTxEmail(admin: AdminClient, messageId: string): Promise<boolean> {
  try {
    const { data } = await admin
      .from("email_send_log")
      .select("id")
      .eq("message_id", messageId)
      .eq("status", "sent")
      .maybeSingle();
    return Boolean(data?.id);
  } catch {
    return false;
  }
}

async function markTxEmailSent(
  admin: AdminClient,
  messageId: string,
  recipient: string,
  label: string,
) {
  try {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: label,
      recipient_email: recipient,
      status: "sent",
    });
  } catch {
    /* unique / optional */
  }
}

async function sendTxEmail(
  admin: AdminClient,
  userId: string,
  alert: ReturnType<typeof formatAlert>,
  tx: TxLike,
  notifications: Record<string, unknown>,
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "OpenPay Pro <noreply@openpy.space>";
  if (!apiKey) {
    console.warn("[tx-alerts] RESEND_API_KEY missing — skip email");
    return;
  }

  const email = await resolveRecipientEmail(admin, userId, notifications);
  if (!email) {
    // Wallet-only auth (Pi / Phantom SIWS) with no linked inbox
    return;
  }

  const messageId = tx.id ? `tx-alert:${tx.id}` : `tx-alert:${walletScopedFallback(tx, userId)}`;
  if (await alreadySentTxEmail(admin, messageId)) return;

  const appUrl = appBaseUrl();
  const accent = alert.kind === "receive" ? "#14F195" : alert.kind === "send" ? "#AB9FF2" : "#38bdf8";
  const status = String(tx.status ?? "confirmed");
  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b0b0f;color:#f5f5f7;padding:24px">
      <div style="max-width:480px;margin:0 auto;background:#16161d;border-radius:16px;padding:24px;border:1px solid #2a2a35">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${accent}">OpenPay Pro</p>
        <h1 style="margin:0 0 8px;font-size:22px;letter-spacing:-0.02em">${escapeHtml(alert.title)}</h1>
        <p style="margin:0 0 4px;font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#fff">${escapeHtml(alert.amountLabel)}</p>
        <p style="margin:0 0 20px;color:#c4c4cc;line-height:1.5">${escapeHtml(alert.body)}</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;color:#a1a1aa">
          <tr><td style="padding:6px 0">Status</td><td style="padding:6px 0;text-align:right;color:#f5f5f7">${escapeHtml(status)}</td></tr>
          ${
            tx.counterparty
              ? `<tr><td style="padding:6px 0">Counterparty</td><td style="padding:6px 0;text-align:right;color:#f5f5f7;font-family:ui-monospace,monospace">${escapeHtml(String(tx.counterparty).slice(0, 42))}</td></tr>`
              : ""
          }
        </table>
        <a href="${appUrl}${alert.url}" style="display:inline-block;background:${accent};color:#0b0b0f;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px">View activity</a>
        <p style="margin:20px 0 0;font-size:11px;color:#71717a">You’re receiving this because Email alerts are on in OpenPay Pro Settings. Manage at ${escapeHtml(appUrl)}/settings</p>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${alert.title} · ${alert.amountLabel}`,
      html,
      headers: { "X-Entity-Ref-ID": messageId },
    }),
  });
  if (!res.ok) {
    console.warn("[tx-alerts] email failed", await res.text());
    return;
  }

  await markTxEmailSent(admin, messageId, email, `tx-${String(tx.type ?? "activity")}`);
}

function walletScopedFallback(tx: TxLike, userId: string) {
  return `${tx.wallet_id || "w"}:${userId}:${tx.type}:${tx.amount}:${tx.created_at || Date.now()}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
