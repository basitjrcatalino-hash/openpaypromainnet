import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy sign-in route — now forwards to the OpenPay-only `/auth` page. */
export const Route = createFileRoute("/authpi")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string; mode?: string } => {
    const next = typeof s.next === "string" ? s.next : undefined;
    const mode = typeof s.mode === "string" ? s.mode : undefined;
    return {
      next: next && next.startsWith("/") && !next.startsWith("//") ? next : undefined,
      mode: mode === "signin" || mode === "signup" ? mode : undefined,
    };
  },
  beforeLoad: ({ search }) => {
    const forward: { next?: string; mode?: string } = {};
    if (search.next) forward.next = search.next;
    if (search.mode) forward.mode = search.mode;
    throw redirect({ to: "/auth", search: forward } as never);
  },
});
