import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createKycVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string }) =>
    z.object({ returnUrl: z.string().url().max(2048) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { createVerification } = await import("./piVerify.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabase
      .from("profiles")
      .select("pi_uid,pi_username")
      .eq("id", userId)
      .maybeSingle();

    const { data: userInfo } = await supabase.auth.getUser();

    const result = await createVerification({
      userId,
      piUid: profile?.pi_uid ?? null,
      email: userInfo.user?.email ?? null,
      returnUrl: data.returnUrl,
    });

    await supabaseAdmin
      .from("profiles")
      .update({
        kyc_status: "pending",
        kyc_verification_id: result.verification_id,
        kyc_updated_at: new Date().toISOString(),
      } as never)
      .eq("id", userId);



    return { verification_url: result.verification_url, verification_id: result.verification_id };
  });

export const getKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("kyc_status,kyc_verification_id,kyc_verified_at,kyc_updated_at")
      .eq("id", userId)
      .maybeSingle();

    // Pull live status if we have a session and the status isn't final yet
    if (profile?.kyc_verification_id && profile.kyc_status !== "verified" && profile.kyc_status !== "rejected") {
      try {
        const { getVerificationStatus } = await import("./piVerify.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const live = await getVerificationStatus(profile.kyc_verification_id);
        if (live.status && live.status !== profile.kyc_status) {
          const patch: Record<string, unknown> = {
            kyc_status: live.status,
            kyc_updated_at: new Date().toISOString(),
          };
          if (live.status === "verified") patch.kyc_verified_at = new Date().toISOString();
          await supabaseAdmin.from("profiles").update(patch as never).eq("id", userId);
          return { ...profile, ...patch };
        }
      } catch { /* ignore polling failure */ }
    }
    return profile ?? { kyc_status: "not_started", kyc_verification_id: null, kyc_verified_at: null, kyc_updated_at: null };
  });
