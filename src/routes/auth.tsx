import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Legacy `/auth` → default sign-in at `/authpi`.
 * Child OAuth callbacks (`/auth/pi/callback`, `/auth/openpay/callback`) still render via Outlet.
 */
export const Route = createFileRoute("/auth")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/auth") {
      throw redirect({ to: "/authpi" });
    }
  },
  component: () => <Outlet />,
});
