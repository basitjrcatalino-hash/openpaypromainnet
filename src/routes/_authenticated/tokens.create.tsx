import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy token create → OpenToken create */
export const Route = createFileRoute("/_authenticated/tokens/create")({
  beforeLoad: () => {
    throw redirect({ to: "/opentoken/create" });
  },
});
