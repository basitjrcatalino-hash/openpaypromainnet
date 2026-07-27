import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout shell so /opentoken/create, /portfolio, /$tokenId, etc. can render. */
export const Route = createFileRoute("/_authenticated/opentoken")({
  component: OpenTokenLayout,
});

function OpenTokenLayout() {
  return <Outlet />;
}
