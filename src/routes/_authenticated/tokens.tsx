import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Tokens explore → OpenToken launchpad */
export const Route = createFileRoute("/_authenticated/tokens")({
  beforeLoad: () => {
    throw redirect({ to: "/opentoken" });
  },
});
