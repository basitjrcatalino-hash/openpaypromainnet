/**
 * MetaMask Embedded Wallets (Web3Auth) — client config.
 * Docs: https://docs.metamask.io/embedded-wallets/authentication/social-logins/oauth/
 */
import { WEB3AUTH_NETWORK } from "@web3auth/modal";
import type { Web3AuthContextConfig } from "@web3auth/modal/react";

export const WEB3AUTH_CLIENT_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_WEB3AUTH_CLIENT_ID ?? "").trim()) ||
  "";

export const METAMASK_EMBEDDED_BRAND = "#E2761B";

/** Prefer Sapphire Devnet on localhost (Mainnet blocks local origins). */
export function resolveWeb3AuthNetwork() {
  const override = String(import.meta.env?.VITE_WEB3AUTH_NETWORK ?? "")
    .trim()
    .toLowerCase();
  if (override === "mainnet" || override === "sapphire_mainnet") {
    return WEB3AUTH_NETWORK.SAPPHIRE_MAINNET;
  }
  if (override === "devnet" || override === "sapphire_devnet") {
    return WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
    }
  }
  return WEB3AUTH_NETWORK.SAPPHIRE_MAINNET;
}

export function getWeb3AuthContextConfig(): Web3AuthContextConfig {
  if (!WEB3AUTH_CLIENT_ID) {
    throw new Error("Missing VITE_WEB3AUTH_CLIENT_ID");
  }
  return {
    web3AuthOptions: {
      clientId: WEB3AUTH_CLIENT_ID,
      web3AuthNetwork: resolveWeb3AuthNetwork(),
      uiConfig: {
        appName: "OpenPay Pro",
        mode: "dark",
        logoLight: `${typeof window !== "undefined" ? window.location.origin : ""}/favicon.ico`,
        logoDark: `${typeof window !== "undefined" ? window.location.origin : ""}/favicon.ico`,
      },
    },
  };
}
