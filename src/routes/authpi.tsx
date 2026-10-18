import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthMethodKey } from "@/lib/auth-methods";

export const Route = createFileRoute("/authpi")({
  validateSearch: (s: Record<string, unknown>) => ({
    method: typeof s.method === "string" && isAuthMethodKey(s.method.toLowerCase()) ? s.method.toLowerCase() : undefined,
    mode: s.mode === "signup" || s.mode === "signin" ? s.mode : undefined,
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  beforeLoad: ({ search }) => { throw redirect({ to: "/auth", search, replace: true }); },
  head: () => ({ meta: [
    { title: "Sign-in moved — OpenPay Pro" },
    { name: "description", content: "OpenPay Pro sign-in and account creation are now at /auth." },
    { property: "og:title", content: "Sign-in moved — OpenPay Pro" },
    { property: "og:description", content: "Connect your wallet or sign in at the OpenPay Pro authentication page." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
