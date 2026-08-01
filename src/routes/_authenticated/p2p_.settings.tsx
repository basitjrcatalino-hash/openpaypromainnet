import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { P2pActionRow, P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/lib/currency";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/p2p_/settings")({
  head: () => ({
    meta: [
      { title: "P2P Settings — OpenPay Pro" },
      { name: "description", content: "Notification and trading preferences for P2P." },
      { property: "og:title", content: "P2P Settings — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: P2pSettingsPage,
});

function P2pSettingsPage() {
  const qc = useQueryClient();
  const { meta } = useCurrency();

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const prefsQ = useQuery({
    queryKey: ["prefs", userQ.data],
    enabled: !!userQ.data,
    queryFn: async () =>
      (
        await supabase
          .from("user_preferences")
          .select("notifications")
          .eq("user_id", userQ.data as string)
          .maybeSingle()
      ).data,
  });

  const notif = (prefsQ.data?.notifications as Record<string, unknown> | null) ?? {};
  const p2pAlerts = typeof notif.p2p_alerts === "boolean" ? notif.p2p_alerts : true;

  const save = useMutation({
    mutationFn: async (nextAlerts: boolean) => {
      const uid = userQ.data;
      if (!uid) throw new Error("Not signed in");
      const { data: row } = await supabase
        .from("user_preferences")
        .select("notifications")
        .eq("user_id", uid)
        .maybeSingle();
      const latest =
        row?.notifications &&
        typeof row.notifications === "object" &&
        !Array.isArray(row.notifications)
          ? (row.notifications as Record<string, unknown>)
          : {};
      const next = { ...latest, p2p_alerts: nextAlerts };
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: uid,
          notifications: next as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["prefs", userQ.data] });
      toast.success("P2P settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <P2pSubpageHeader title="P2P settings" />

      <p className="px-4 py-3 text-xs text-muted-foreground md:px-6">
        Controls that only affect P2P trading. App-wide settings stay in Settings.
      </p>

      <P2pMenuCard className="mb-3">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold">Order alert sounds</p>
            <p className="text-[12px] text-muted-foreground">
              Toast + sound for new orders, status changes, and messages
            </p>
          </div>
          <Switch
            checked={p2pAlerts}
            disabled={save.isPending}
            onCheckedChange={(v) => save.mutate(v)}
          />
        </div>
      </P2pMenuCard>

      <P2pMenuCard className="mb-3">
        <P2pActionRow
          to="/p2p/payments"
          title="Payment methods"
          desc="Receive accounts shown to buyers"
        />
        <P2pActionRow to="/p2p/create" title="My ads" desc="Publish, pause, or edit offers" />
        <P2pActionRow
          to="/p2p/wallet"
          title="Merchant wallet"
          desc="Crypto available for escrow"
        />
      </P2pMenuCard>

      <P2pMenuCard className="mb-3">
        <P2pActionRow
          to="/settings"
          title={`Display currency · ${meta.code}`}
          desc="Used for P2P prices and limits"
        />
        <P2pActionRow to="/p2p/security" title="Security" desc="Escrow safety & account lock" />
      </P2pMenuCard>

      <p className="px-4 pb-8 text-center text-[11px] text-muted-foreground md:px-6">
        Need app language or theme?{" "}
        <Link to="/settings" className="font-semibold text-primary">
          Open app settings
        </Link>
      </p>
    </div>
  );
}
