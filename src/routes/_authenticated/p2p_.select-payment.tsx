import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { P2pPaymentMethodPicker } from "@/components/p2p/P2pPaymentMethodPicker";
import { P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { fetchPaymentMethods } from "@/lib/p2p";

type SelectPaymentSearch = {
  method?: string;
  return?: "/p2p" | "/p2p/express";
  all?: string;
  codes?: string;
};

export const Route = createFileRoute("/_authenticated/p2p_/select-payment")({
  validateSearch: (s: Record<string, unknown>): SelectPaymentSearch => {
    const ret = s.return === "/p2p/express" ? "/p2p/express" : "/p2p";
    return {
      method: typeof s.method === "string" && s.method.trim() ? s.method.trim() : undefined,
      return: ret,
      all: s.all === "1" || s.all === "true" || s.all === true ? "1" : undefined,
      codes: typeof s.codes === "string" && s.codes.trim() ? s.codes.trim() : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Payment methods — OpenPay Pro P2P" },
      {
        name: "description",
        content: "Choose a payment method to filter P2P ads or complete an Express trade.",
      },
      { property: "og:title", content: "Payment methods — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SelectPaymentPage,
});

function SelectPaymentPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const returnTo = search.return ?? "/p2p";
  const allowAll = returnTo === "/p2p" || search.all === "1";

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });

  const allowed = useMemo(() => {
    if (!search.codes) return null;
    return new Set(
      search.codes
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean),
    );
  }, [search.codes]);

  const methods = useMemo(() => {
    const list = methodsQ.data ?? [];
    if (!allowed) return list;
    return list.filter((m) => allowed.has(m.code));
  }, [methodsQ.data, allowed]);

  const finish = (code: string | null) => {
    void navigate({
      to: returnTo,
      search: (code ? { pay: code } : {}) as never,
    });
  };

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <P2pSubpageHeader title="Payment methods" backTo={returnTo} />

      <p className="px-4 pb-1 pt-3 text-xs text-muted-foreground md:px-6">
        {returnTo === "/p2p/express"
          ? "Choose how you want to complete this Express trade"
          : "Filter ads by how you want to pay or get paid"}
      </p>

      {methodsQ.isLoading ? (
        <div className="grid flex-1 place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-2 md:px-6">
          <P2pPaymentMethodPicker
            methods={methods}
            mode="single"
            value={search.method ?? null}
            showAllOption={allowAll}
            onSelectAll={allowAll ? () => finish(null) : undefined}
            onSelect={(code) => finish(code)}
            maxHeightClass="max-h-[calc(100dvh-11.5rem)]"
          />
        </div>
      )}
    </div>
  );
}
