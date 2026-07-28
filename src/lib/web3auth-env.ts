/** Client-safe Web3Auth env — no SDK imports (keeps auth routes off the Web3Auth graph). */

export const WEB3AUTH_CLIENT_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_WEB3AUTH_CLIENT_ID ?? "").trim()) ||
  "";

export const METAMASK_EMBEDDED_BRAND = "#E2761B";
