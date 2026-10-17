import { createPublicClient, custom, createWalletClient, formatUnits, getAddress, type EIP1193Provider, http } from "viem";
import { arcMainnet, validateArcPayment } from "./arc-network";
import { supabase } from "@/integrations/supabase/client";

export function arcProvider(): EIP1193Provider {
  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new Error("Open this page in an EVM wallet browser or install an EVM wallet extension.");
  return provider;
}

export async function connectArcWallet() {
  const provider = arcProvider();
  const addresses = await provider.request({ method: "eth_requestAccounts" });
  const first = addresses[0];
  if (!first) throw new Error("No wallet account was selected.");
  return getAddress(first);
}

export async function switchToArc() {
  const provider = arcProvider();
  try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13b2" }] }); }
  catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x13b2", chainName: "Arc Mainnet", nativeCurrency: arcMainnet.nativeCurrency, rpcUrls: arcMainnet.rpcUrls.default.http, blockExplorerUrls: [arcMainnet.blockExplorers.default.url] }] });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13b2" }] });
  }
  const id = await provider.request({ method: "eth_chainId" });
  if (id !== "0x13b2") throw new Error("Switch your wallet to Arc Mainnet before continuing.");
}

export async function arcBalance(address: `0x${string}`) {
  const client = createPublicClient({ chain: arcMainnet, transport: http() });
  const chainId = await client.getChainId();
  if (chainId !== arcMainnet.id) throw new Error("Arc RPC returned an unexpected network. Transactions are blocked.");
  return formatUnits(await client.getBalance({ address }), 18);
}

export async function verifyArcWallet(purpose: "link" | "login") {
  const address = await connectArcWallet();
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  const call = async (body: unknown) => {
    const res = await fetch("/api/public/arc-auth", { method: "POST", headers, body: JSON.stringify(body) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Wallet verification failed.");
    return result;
  };
  const challenge = await call({ action: "challenge", address, purpose });
  const wallet = createWalletClient({ transport: custom(arcProvider()) });
  const signature = await wallet.signMessage({ account: address, message: challenge.message });
  const result = await call({ action: "verify", id: challenge.id, signature, purpose });
  if (purpose === "login") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "magiclink" });
    if (error) throw error;
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw new Error("The account session could not be confirmed.");
  }
  return address;
}

export async function arcPayment(amount: string, recipient: string) {
  validateArcPayment(amount, recipient);
  await switchToArc();
  const address = await connectArcWallet();
  await arcBalance(address);
  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"), import("@circle-fin/adapter-viem-v2"),
  ]);
  const adapter = await createViemAdapterFromProvider({ provider: arcProvider() });
  const result = await new AppKit().send({ from: { adapter, chain: "Arc" }, to: getAddress(recipient), amount, token: "USDC" });
  if (result.state === "error") throw new Error(result.errorMessage || "Transfer failed.");
  return result;
}

export async function bridgeToArc(amount: string, source: "Base" | "Ethereum" | "Arbitrum") {
  validateArcPayment(amount);
  const address = await connectArcWallet();
  await arcBalance(address);
  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"), import("@circle-fin/adapter-viem-v2"),
  ]);
  const adapter = await createViemAdapterFromProvider({ provider: arcProvider() });
  const result = await new AppKit().bridge({ from: { adapter, chain: source }, to: { adapter, chain: "Arc" }, amount });
  return result;
}