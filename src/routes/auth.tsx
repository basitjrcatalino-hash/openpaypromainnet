import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Legacy `/auth` → default sign-in at `/authpi`.
 * Child OAuth callbacks (`/auth/pi/callback`, `/auth/openpay/callback`) still render via Outlet.
 * Forwards method / next / mode so deep links like `/auth?method=email` work.
 */
export const Route = createFileRoute("/auth")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path !== "/auth") return;

    const raw: Record<string, unknown> =
      typeof location.search === "object" && location.search !== null
        ? (location.search as Record<string, unknown>)
        : Object.fromEntries(new URLSearchParams(location.searchStr ?? "").entries());

    const search: { method?: string; next?: string; mode?: string } = {};
    if (typeof raw.method === "string" && raw.method) search.method = raw.method;
    if (typeof raw.next === "string" && raw.next) search.next = raw.next;
    if (typeof raw.mode === "string" && raw.mode) search.mode = raw.mode;

    throw redirect({
      to: "/authpi",
      ...(Object.keys(search).length ? { search } : {}),
    } as never);
  },
  component: () => <Outlet />,
});
