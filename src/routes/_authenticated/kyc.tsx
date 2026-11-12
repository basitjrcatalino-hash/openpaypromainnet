import { createFileRoute, redirect } from "@tanstack/react-router";

// KYC is not part of OpenPay Pro. Old /kyc links land on the dashboard.
export const Route = createFileRoute("/_authenticated/kyc")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
