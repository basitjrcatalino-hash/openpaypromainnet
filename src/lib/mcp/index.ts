import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getProfileTool from "./tools/get-profile";
import listLedgerEntriesTool from "./tools/list-ledger-entries";
import listTransactionsTool from "./tools/list-transactions";
import listWalletsTool from "./tools/list-wallets";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "openpay-pro-wallet-main",
  title: "OpenPay Pro Wallet MAIN",
  version: "0.1.0",
  instructions:
    "Tools for the OpenPay Pro wallet. Callers act as the signed-in user: read their profile, wallets and balances, their transaction history, and the public OpenPay ledger.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, listWalletsTool, listTransactionsTool, listLedgerEntriesTool],
});
