import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { isLedgerAssetCode } from "@/lib/ledger-majors";

const paySearchSchema = z.object({
  asset: z.string().optional(),
  amount: z.string().optional(),
  token: z.string().uuid().optional(),
});

/**
 * Public HTTPS pay link encoded in receive QRs.
 * Phone cameras open this (unlike custom `openpay:` schemes that show "No data").
 * Logged-in users go to Send; others sign in then continue.
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

    const asset =
      (search.asset && isLedgerAssetCode(search.asset.toUpperCase())
        ? search.asset.toUpperCase()
        : parsed.asset) || "OUSD";

    const sendSearch = {
      to,
      rail: parsed.rail,
      asset: asset as
        | "OUSD"
        | "PI"
        | "BTC"
        | "ETH"
        | "SOL"
        | "USDC"
        | "USDT"
        | "PYUSD"
        | "USDG"
        | "USD1"
        | "CASH"
        | "EURC",
      ...(search.amount || parsed.amount
        ? { amount: search.amount || parsed.amount }
        : {}),
      ...(search.token || parsed.token ? { token: search.token || parsed.token } : {}),
    };

    const next = `/send?${new URLSearchParams(
      Object.entries(sendSearch).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v != null && String(v).length) acc[k] = String(v);
        return acc;
      }, {}),
    ).toString()}`;

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      // Use href so ?next= is preserved (authpi reads it from the URL).
      if (typeof window !== "undefined") {
        throw redirect({ href: `/authpi?next=${encodeURIComponent(next)}` });
      }
      throw redirect({ to: "/authpi" });
    }
    throw redirect({ to: "/send", search: sendSearch });
  },
});
