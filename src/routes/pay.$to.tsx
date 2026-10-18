import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { isLedgerAssetCode, type LedgerAssetCode } from "@/lib/ledger-majors";

const paySearchSchema = z.object({
  asset: z.string().optional(),
  amount: z.string().optional(),
  token: z.string().uuid().optional(),
});

type SendAsset = LedgerAssetCode;

/**
 * Public HTTPS pay link encoded in receive QRs.
 * Phone cameras open this (unlike custom `openpay:` schemes that show "No data").
 * Logged-in users go to Send; others sign in then continue.
 * Supports all OpenPay Pro ledger assets and OpenToken (token=uuid) QRs.
 */
export const Route = createFileRoute("/pay/$to")({
  validateSearch: (search) => paySearchSchema.parse(search),
  beforeLoad: async ({ params, search }) => {
    const raw = `https://openpaypro.space/pay/${encodeURIComponent(params.to)}${
      search.asset || search.amount || search.token
        ? `?${new URLSearchParams({
            ...(search.asset ? { asset: search.asset } : {}),
            ...(search.amount ? { amount: search.amount } : {}),
            ...(search.token ? { token: search.token } : {}),
          }).toString()}`
        : ""
    }`;
    const parsed = parsePaymentQr(raw);
    const to = parsed.to || decodeURIComponent(params.to).replace(/^@+/, "");
    if (!to) {
      throw redirect({ to: "/authpi" });
    }

    const amount = search.amount || parsed.amount || undefined;
    const token = search.token || parsed.token || undefined;
    const rail = parsed.rail === "openpay" ? ("openpay" as const) : ("wallet" as const);
    const ledgerAsset: SendAsset =
      (search.asset && isLedgerAssetCode(search.asset.toUpperCase())
        ? (search.asset.toUpperCase() as SendAsset)
        : parsed.asset) || "OUSD";

    const qs = new URLSearchParams({ to, rail });
    if (amount) qs.set("amount", amount);
    if (token) qs.set("token", token);
    else qs.set("asset", ledgerAsset);
    const next = `/send?${qs.toString()}`;

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (typeof window !== "undefined") {
        throw redirect({ href: `/authpi?next=${encodeURIComponent(next)}` });
      }
      throw redirect({ to: "/authpi" });
    }

    if (token) {
      throw redirect({
        to: "/send",
        search: { to, rail, token, ...(amount ? { amount } : {}) },
      });
    }

    throw redirect({
      to: "/send",
      search: { to, rail, asset: ledgerAsset, ...(amount ? { amount } : {}) },
    });
  },
});
