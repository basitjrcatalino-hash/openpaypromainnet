import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TARGET_WALLETS = 10;

type PiPayment = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
  from_address?: string;
  to_address?: string;
  network?: string;
  transaction?: { txid?: string; verified?: boolean } | null;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
};

type PiClient = {
  createPayment: (paymentData: Record<string, unknown>) => Promise<string>;
  submitPayment: (paymentId: string) => Promise<string>;
  completePayment: (paymentId: string, txid: string) => Promise<PiPayment>;
  cancelPayment: (paymentId: string) => Promise<PiPayment>;
  getPayment: (paymentId: string) => Promise<PiPayment>;
  getIncompleteServerPayments: () => Promise<PiPayment[]>;
  myKeypair?: { publicKey: () => string };
};

type PiSdkError = Error & {
  code?: string;
  payment?: PiPayment;
  txid?: string;
  response?: { data?: Record<string, unknown>; status?: number };
};

function safeStringify(v: unknown) { try { return JSON.stringify(v); } catch { return String(v); } }
function extractErrorCode(err: unknown) { return String((err as PiSdkError)?.code || (err as PiSdkError)?.response?.data?.error || ""); }
function extractEmbeddedPayment(err: unknown): PiPayment | null { const e = err as PiSdkError; return e?.payment || (e?.response?.data?.payment as PiPayment) || null; }
function extractLinkedTxid(err: unknown) { return String((err as PiSdkError)?.txid || (err as PiSdkError)?.response?.data?.txid || ""); }
function extractErrorMessage(err: unknown) { const e = err as PiSdkError; const d = e?.response?.data; return String((d && (d.error_message || d.message || JSON.stringify(d))) || e?.message || "A2U payment failed"); }
function extractErrorStatus(err: unknown) { return (err as { response?: { status?: number } })?.response?.status; }
function isOngoingPaymentError(err: unknown) {
  const code = extractErrorCode(err);
  const msg = extractErrorMessage(err).toLowerCase();
  return code === "ongoing_payment_found" || msg.includes("ongoing payment") || msg.includes("ongoing_payment") || msg.includes("incomplete_server_payments");
}
function isPaymentVerified(p: PiPayment) {
  return p.status?.transaction_verified === true && p.status?.developer_completed === true && p.status?.cancelled !== true && p.status?.user_cancelled !== true;
}
function summarizePayment(p: PiPayment) {
  return { payment_id: p.identifier, uid: p.user_uid, amount: p.amount, memo: p.memo, network: p.network, from_address: p.from_address || null, to_address: p.to_address || null, txid: p.transaction?.txid || null, status: p.status || null };
}

async function verifyPiAccessToken(token: string) {
  const r = await fetch("https://api.minepi.com/v2/me", { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.uid) {
    const err = new Error(data?.error || "Pi auth failed") as Error & { status?: number };
    err.status = r.status || 401;
    throw err;
  }
  return { uid: String(data.uid), username: typeof data.username === "string" ? data.username : "" };
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const PI_API_KEY = process.env.PI_A2U_API_KEY || process.env.PI_API_KEY || "";
  const PI_WALLET_SEED = process.env.PI_WALLET_PRIVATE_SEED || "";
  const REWARD_AMOUNT = Number(process.env.PI_A2U_AMOUNT || "0.01");
  const DEFAULT_MEMO = process.env.PI_A2U_MEMO || "Testnet reward";

  // Load Supabase admin client (server-only)
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  async function logDiagnostic(params: { uid?: string; username?: string; level?: "info"|"warn"|"error"; message: string; details?: Record<string, unknown>; amount?: number; memo?: string }) {
    const level = params.level || "info";
    const now = new Date().toISOString();
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`[pi-a2u:${level}] ${params.message}`, params.details || {});
    await supabaseAdmin.from("pi_a2u_transactions").insert({
      uid: params.uid || "system",
      username: params.username || null,
      payment_id: `log:${Date.now()}:${crypto.randomUUID()}`,
      amount: params.amount ?? REWARD_AMOUNT,
      memo: params.memo || DEFAULT_MEMO,
      status: `log_${level}`,
      error: safeStringify({ message: params.message, details: params.details, timestamp: now }).slice(0, 7000),
      created_at: now, updated_at: now,
    }).then(({ error }: { error: { message: string } | null }) => { if (error) console.error("Log persist failed", error.message); });
  }

  function makeLogger(uid?: string, username?: string, amount = REWARD_AMOUNT, memo = DEFAULT_MEMO) {
    return (level: "info"|"warn"|"error", message: string, details?: Record<string, unknown>) =>
      logDiagnostic({ uid, username, level, message, details, amount, memo });
  }

  async function getPiClient(): Promise<PiClient> {
    if (!PI_API_KEY || !PI_WALLET_SEED) throw new Error("Missing PI_A2U_API_KEY or PI_WALLET_PRIVATE_SEED");
    const mod = (await import("pi-backend")) as unknown as { default?: new (k: string, s: string) => PiClient };
    const PiCtor = (mod.default ?? (mod as unknown as new (k: string, s: string) => PiClient));
    return new PiCtor(PI_API_KEY, PI_WALLET_SEED);
  }

  function getConfiguredWalletAddress(pi: PiClient) { return pi.myKeypair?.publicKey?.() || ""; }

  async function getProgress() {
    const { count } = await supabaseAdmin.from("pi_a2u_wallets").select("*", { count: "exact", head: true });
    const unique = count ?? 0;
    return { unique_wallets: unique, target: TARGET_WALLETS, progress_label: `${unique} / ${TARGET_WALLETS} unique wallets completed`, completed: unique >= TARGET_WALLETS };
  }

  async function hasSuccessfulReward(uid: string) {
    const { data } = await supabaseAdmin.from("pi_a2u_transactions").select("id").eq("uid", uid).eq("status", "success").maybeSingle();
    return Boolean(data);
  }

  async function saveTransaction(params: { uid: string; username?: string; paymentId: string; amount: number; memo: string; status: string; txid?: string | null; walletAddress?: string | null; error?: string | null }) {
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin.from("pi_a2u_transactions").select("id").eq("payment_id", params.paymentId).maybeSingle();
    const row = { uid: params.uid, username: params.username || null, payment_id: params.paymentId, amount: params.amount, memo: params.memo, status: params.status, txid: params.txid || null, wallet_address: params.walletAddress || null, error: params.error || null, updated_at: now };
    if (existing) await supabaseAdmin.from("pi_a2u_transactions").update(row).eq("id", (existing as { id: number }).id);
    else await supabaseAdmin.from("pi_a2u_transactions").insert({ ...row, created_at: now });
  }

  async function recordSuccess(payment: PiPayment, username = "") {
    const paymentId = payment.identifier;
    const uid = payment.user_uid;
    const txid = payment.transaction?.txid || "";
    const walletAddress = payment.to_address || "";
    await saveTransaction({ uid, username, paymentId, amount: Number(payment.amount || REWARD_AMOUNT), memo: payment.memo || DEFAULT_MEMO, status: "success", txid, walletAddress });
    let walletAdded = false;
    if (walletAddress && txid) {
      const { error } = await supabaseAdmin.from("pi_a2u_wallets").insert({ uid, username, wallet_address: walletAddress, payment_id: paymentId, txid, amount: Number(payment.amount || REWARD_AMOUNT) });
      walletAdded = !error;
    }
    return { walletAdded };
  }

  async function resolvePayment(pi: PiClient, payment: PiPayment, username = "", options: { ignoreSeedMismatchWithoutTx?: boolean } = {}, logStep?: ReturnType<typeof makeLogger>) {
    const paymentId = payment.identifier;
    const uid = payment.user_uid;
    const amount = Number(payment.amount || REWARD_AMOUNT);
    const memo = payment.memo || DEFAULT_MEMO;
    const configuredWallet = getConfiguredWalletAddress(pi);
    await logStep?.("info", "Resolving Pi server payment", { payment: summarizePayment(payment), configured_wallet: configuredWallet || null });

    if (payment.status?.cancelled || payment.status?.user_cancelled) {
      await saveTransaction({ uid, username, paymentId, amount, memo, status: "failed", error: "Pi payment was cancelled before completion" });
      return { completed: false, cancelled: true };
    }

    if (payment.from_address && configuredWallet && payment.from_address !== configuredWallet) {
      const message = `PI_WALLET_PRIVATE_SEED does not match the Pi app wallet for this payment. App wallet: ${payment.from_address}; configured seed wallet: ${configuredWallet}`;
      if (!payment.transaction?.txid) { await logStep?.("warn", "Cancelling payment: seed mismatch", { payment_id: paymentId }); await pi.cancelPayment(paymentId).catch(() => null); }
      await saveTransaction({ uid, username, paymentId, amount, memo, status: "failed", error: message });
      if (options.ignoreSeedMismatchWithoutTx && !payment.transaction?.txid) return { completed: false, cancelled: true };
      throw new Error(message);
    }

    let txid = payment.transaction?.txid || "";
    await saveTransaction({ uid, username, paymentId, amount, memo, status: txid ? "submitted" : "pending", txid });

    if (isPaymentVerified(payment)) {
      const { walletAdded } = await recordSuccess(payment, username);
      return { completed: true, payment, txid, walletAdded };
    }

    if (!txid) {
      await logStep?.("info", "Submitting Pi blockchain transaction", { payment_id: paymentId });
      try {
        txid = await pi.submitPayment(paymentId);
      } catch (error) {
        const linkedTxid = extractLinkedTxid(error);
        if (extractErrorCode(error) === "payment_already_has_linked_txid" && linkedTxid) {
          txid = linkedTxid;
          await logStep?.("warn", "Payment already had linked txid; completing existing", { payment_id: paymentId, txid });
        } else {
          throw error;
        }
      }
      await saveTransaction({ uid, username, paymentId, amount, memo, status: "submitted", txid });
    }

    await logStep?.("info", "Completing Pi payment with txid", { payment_id: paymentId, txid });
    const completedPayment = await pi.completePayment(paymentId, txid);
    if (!isPaymentVerified(completedPayment)) {
      await saveTransaction({ uid, username, paymentId, amount, memo, status: "failed", txid, walletAddress: completedPayment.to_address || payment.to_address || null, error: "Payment completed but Pi verification flags are not satisfied" });
      throw new Error("Payment completed but Pi verification flags are not satisfied");
    }

    const { walletAdded } = await recordSuccess(completedPayment, username);
    await logStep?.("info", "Pi A2U payment completed successfully", { payment_id: paymentId, txid, wallet_address: completedPayment.to_address || null, wallet_added: walletAdded });
    return { completed: true, payment: completedPayment, txid, walletAdded };
  }

  async function resolveIncompletePayments(pi: PiClient, currentUid?: string, username = "", logStep?: ReturnType<typeof makeLogger>) {
    const incomplete = await pi.getIncompleteServerPayments().catch(async (error) => {
      await logStep?.("error", "Unable to read incomplete server payments", { code: extractErrorCode(error), error: extractErrorMessage(error) });
      return [] as PiPayment[];
    });
    if (!Array.isArray(incomplete) || incomplete.length === 0) return [];
    const ordered = [...incomplete].sort((a, b) => {
      if (a.user_uid === currentUid && b.user_uid !== currentUid) return -1;
      if (a.user_uid !== currentUid && b.user_uid === currentUid) return 1;
      return 0;
    });
    const results: Array<{ completed: boolean; payment?: PiPayment; txid?: string; walletAdded?: boolean }> = [];
    for (const payment of ordered) {
      try {
        results.push(await resolvePayment(pi, payment, payment.user_uid === currentUid ? username : "", { ignoreSeedMismatchWithoutTx: true }, logStep));
      } catch (error) {
        if (extractErrorMessage(error).includes("PI_WALLET_PRIVATE_SEED does not match")) throw error;
        await logStep?.("error", "Incomplete payment recovery failed", { payment_id: payment.identifier, uid: payment.user_uid, error: extractErrorMessage(error) });
      }
    }
    return results;
  }

  async function createPaymentWithRecovery(pi: PiClient, paymentData: Record<string, unknown>, username: string, logStep: ReturnType<typeof makeLogger>) {
    try {
      await logStep("info", "Creating Pi A2U payment", { payment_data: paymentData });
      return await pi.createPayment(paymentData);
    } catch (error) {
      if (!isOngoingPaymentError(error)) throw error;
      const embeddedPayment = extractEmbeddedPayment(error);
      await logStep("warn", "Pi reports ongoing payment; starting recovery", { code: extractErrorCode(error), error: extractErrorMessage(error), status: extractErrorStatus(error), embedded_payment: embeddedPayment ? summarizePayment(embeddedPayment) : null });
      const recoveryResults: Array<{ completed: boolean; payment?: PiPayment; txid?: string; walletAdded?: boolean }> = [];
      if (embeddedPayment?.identifier) {
        try {
          recoveryResults.push(await resolvePayment(pi, embeddedPayment, embeddedPayment.user_uid === String(paymentData.uid || "") ? username : "", { ignoreSeedMismatchWithoutTx: true }, logStep));
        } catch (recoveryError) {
          await logStep("error", "Embedded ongoing payment recovery failed", { payment_id: embeddedPayment.identifier, error: extractErrorMessage(recoveryError) });
          throw recoveryError;
        }
      }
      recoveryResults.push(...(await resolveIncompletePayments(pi, String(paymentData.uid || ""), username, logStep)));
      const recoveredForCurrentUser = recoveryResults.find(r => r?.completed === true && r?.payment?.user_uid === String(paymentData.uid || "") && r?.payment?.identifier);
      if (recoveredForCurrentUser?.payment) {
        return recoveredForCurrentUser.payment.identifier;
      }
      if (await hasSuccessfulReward(String(paymentData.uid || ""))) throw new Error("You have already claimed this testnet reward.");
      try {
        return await pi.createPayment(paymentData);
      } catch (retryError) {
        if (isOngoingPaymentError(retryError)) throw new Error("Pi still reports an ongoing payment after recovery. Open the Pi Wallet/Payments screen in Pi Browser and cancel or finish the pending payment, then retry.");
        throw retryError;
      }
    }
  }

  async function handleClaim(uid: string, username: string, amount: number, memo: string): Promise<Response> {
    const logStep = makeLogger(uid, username, amount, memo);
    await logStep("info", "Claim request received", { uid, username, amount, memo, secrets_present: { pi_api_key: Boolean(PI_API_KEY), pi_wallet_private_seed: Boolean(PI_WALLET_SEED) } });

    if (await hasSuccessfulReward(uid)) { await logStep("warn", "Claim blocked: already rewarded"); return json({ error: "You have already claimed this testnet reward." }, 409); }

    const progress = await getProgress();
    if (progress.completed) { await logStep("warn", "Claim blocked: target complete", { progress }); return json({ error: "Testnet goal reached: 10 unique wallets completed.", progress }, 409); }

    const pi = await getPiClient();
    await logStep("info", "Pi backend client initialized", { configured_wallet: getConfiguredWalletAddress(pi) || null });
    const paymentData = { amount, memo: memo || DEFAULT_MEMO, metadata: { source: "testnet-a2u", uid, username, created_at: new Date().toISOString() }, uid };

    let paymentId = "";
    let txid = "";
    try {
      paymentId = await createPaymentWithRecovery(pi, paymentData, username, logStep);
      const payment = await pi.getPayment(paymentId);
      const result = await resolvePayment(pi, payment, username, {}, logStep);
      const completedPayment = result.payment!;
      txid = result.txid || completedPayment.transaction?.txid || "";
      const newProgress = await getProgress();
      return json({ success: true, data: { payment_id: paymentId, txid, wallet_address: completedPayment.to_address || "", amount, memo: paymentData.memo, wallet_added: result.walletAdded, progress: newProgress } });
    } catch (error: unknown) {
      const apiStatus = extractErrorStatus(error);
      const message = extractErrorMessage(error);
      await logStep("error", "A2U claim failed", { status: apiStatus || null, message, payment_id: paymentId || null });
      if (paymentId) await saveTransaction({ uid, username, paymentId, amount, memo: paymentData.memo, status: "failed", txid: txid || null, error: message });
      const status = message.includes("already claimed") ? 409 : message.includes("PI_WALLET_PRIVATE_SEED does not match") ? 500 : apiStatus || 500;
      return json({ error: message, payment_id: paymentId || undefined }, status);
    }
  }

  async function getAdminDashboard() {
    const progress = await getProgress();
    const { data: txs } = await supabaseAdmin.from("pi_a2u_transactions").select("*").order("created_at", { ascending: false }).limit(200);
    const { data: wallets } = await supabaseAdmin.from("pi_a2u_wallets").select("wallet_address, uid, username, txid, payment_id, created_at").order("created_at", { ascending: false });
    type TxRow = { id: number; uid: string; username: string | null; status: string; error: string | null; created_at: string };
    const allTxs = (txs || []) as TxRow[];
    const transactions = allTxs.filter(t => !String(t.status || "").startsWith("log_"));
    const logs = allTxs.filter(t => String(t.status || "").startsWith("log_")).map(t => {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(String(t.error || "{}")); } catch { parsed = { message: t.error || "Diagnostic event" }; }
      return { timestamp: t.created_at, level: String(t.status || "log_info").replace("log_", ""), message: String(parsed.message || "Diagnostic event"), details: parsed.details || {}, uid: t.uid, username: t.username };
    });
    const success = transactions.filter(t => t.status === "success");
    const failed = transactions.filter(t => t.status === "failed");
    const walletList = (wallets || []) as Array<{ wallet_address: string }>;
    return { progress: { ...progress, wallets: walletList }, total_successful_a2u: success.length, unique_wallets_count: walletList.length, wallet_addresses: walletList.map(w => w.wallet_address), transactions, successful_transactions: success, failed_transactions: failed, logs };
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as { action?: string })?.action || "");

    if (action === "auth_verify") {
      const token = String((body as { accessToken?: string })?.accessToken || "");
      if (!token) return json({ error: "Missing accessToken" }, 400);
      const user = await verifyPiAccessToken(token);
      return json({ success: true, data: user });
    }
    if (action === "progress") { return json({ success: true, data: await getProgress() }); }
    if (action === "admin_dashboard") { return json({ success: true, data: await getAdminDashboard() }); }
    if (action === "claim") {
      const b = body as { accessToken?: string; amount?: number; memo?: string };
      const token = String(b?.accessToken || "");
      if (!token) return json({ error: "Missing accessToken" }, 401);
      const user = await verifyPiAccessToken(token);
      const amount = Number(b?.amount ?? REWARD_AMOUNT);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 5) return json({ error: "Invalid amount" }, 400);
      const memo = String(b?.memo || DEFAULT_MEMO);
      return await handleClaim(user.uid, user.username, amount, memo);
    }
    return json({ error: "Invalid action" }, 400);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json({ error: message }, status);
  }
}

export const Route = createFileRoute("/api/public/pi-a2u")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});