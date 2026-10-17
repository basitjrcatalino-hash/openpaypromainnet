import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { arcAddressSchema, arcPartnerTransferSchema } from "./openpay-arc";
import { z } from "zod";

export const getOpenPayArcSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => z.object({ address: arcAddressSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: flags, error } = await context.supabase.from("auth_methods").select("enabled").eq("method_key", "arc").maybeSingle();
    if (error || flags?.enabled !== true) throw new Error("Arc wallet access is currently unavailable.");
    const { openPayArcSnapshot } = await import("./openpay-arc.server");
    return openPayArcSnapshot(data.address);
  });

export const prepareOpenPayArcPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string; recipient: string; amount: string }) => arcPartnerTransferSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: flags, error } = await context.supabase.from("auth_methods").select("enabled").eq("method_key", "arc").maybeSingle();
    if (error || flags?.enabled !== true) throw new Error("Arc wallet access is currently unavailable.");
    const { data: link, error: linkError } = await context.supabase.from("arc_wallet_links").select("address").eq("address", data.address.toLowerCase()).eq("user_id", context.userId).maybeSingle();
    if (linkError || !link) throw new Error("Link this wallet to your account before using OpenPay Arc transfers.");
    const { prepareOpenPayArcTransfer } = await import("./openpay-arc.server");
    return prepareOpenPayArcTransfer(data.amount, data.recipient);
  });