/**
 * Server-side transaction alerts — Web Push (lock screen / notification center)
 * and email (Resend) for every wallet transaction.
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

function formatAlert(tx: TxLike): { title: string; body: string; url: string } {
  const symbol = String(tx.token_symbol ?? "token").replace(/^\$/, "");
  const type = String(tx.type ?? "activity");
  const amount = Number(tx.amount ?? 0);
  const amt =
    Number.isFinite(amount) && amount !== 0
      ? `${amount > 0 && (type === "receive" || type === "buy" || type === "reward") ? "+" : ""}${amount} ${symbol}`
      : symbol;

  const title =
    type === "receive" || type === "buy" || type === "reward"
      ? `Received ${symbol}`
      : type === "send" || type === "sell"
        ? `Sent ${symbol}`
        : type === "swap"
          ? `Swapped ${symbol}`
          : type === "mint"
            ? `Minted ${symbol}`
            : `OpenPay · ${type}`;

  const body =
    tx.memo?.trim() ||
    (tx.counterparty ? `${amt} · ${String(tx.counterparty).slice(0, 24)}` : `${amt} · ${tx.status ?? "confirmed"}`);

  return { title, body, url: "/activity" };
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return /@(pi|telegram|solana|walletconnect|privy|openpay)\.|@openpay\.(local|auth|wallet)|\.local$/i.test(
    email,
  );
}

type AdminClient = {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user?: { email?: string | null } | null } }> } };
};

export async function notifyWalletTransaction(
  admin: AdminClient,
  walletId: string,
  tx: TxLike,
): Promise<void> {
  try {
    const { data: wallet } = await admin
      .from("wallets")
      .select("user_id")
      .eq("id", walletId)
      .maybeSingle();
    const userId = wallet?.user_id as string | undefined;
    if (!userId) return;

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
        ...alert,
        txId: tx.id,
        tag: tx.id || "openpay-tx",
      });
    }

    if (emailOn) {
      await sendTxEmail(admin, userId, alert);
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

async function sendTxEmail(
  admin: AdminClient,
  userId: string,
  alert: { title: string; body: string; url: string },
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "OpenPay Pro <noreply@openpy.space>";
  if (!apiKey) return;

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (isSyntheticEmail(email) || !email) return;

  const appUrl = process.env.APP_URL?.trim() || process.env.VITE_APP_URL?.trim() || "https://openpaypro.space";
  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b0b0f;color:#f5f5f7;padding:24px">
      <div style="max-width:480px;margin:0 auto;background:#16161d;border-radius:16px;padding:24px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a78bfa">OpenPay Pro</p>
        <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(alert.title)}</h1>
        <p style="margin:0 0 20px;color:#c4c4cc;line-height:1.5">${escapeHtml(alert.body)}</p>
        <a href="${appUrl}${alert.url}" style="display:inline-block;background:#ab9ff2;color:#1a1330;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px">View activity</a>
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
      subject: alert.title,
      html,
    }),
  });
  if (!res.ok) {
    console.warn("[tx-alerts] email failed", await res.text());
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
