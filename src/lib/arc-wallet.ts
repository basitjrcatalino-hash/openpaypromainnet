import { createPublicClient, custom, createWalletClient, formatUnits, getAddress, type EIP1193Provider, http, erc20Abi, parseUnits } from "viem";
import { arcMainnet, validateArcPayment } from "./arc-network";
import { ensureArcMainnet, signArcAuthMessage } from "./arc-signing";
import { verifyArcPreparedTransfer, type ArcPreparedTransfer } from "./openpay-arc";
import { supabase } from "@/integrations/supabase/client";

export function arcProvider(preferred?: EIP1193Provider): EIP1193Provider {
  if (preferred) return preferred;
  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new Error("Open this page in an EVM wallet browser or install an EVM wallet extension.");
  return provider;
}

export async function connectArcWallet(preferred?: EIP1193Provider) {
  const provider = arcProvider(preferred);
  const addresses = await provider.request({ method: "eth_requestAccounts" });
  const first = addresses[0];
  if (!first) throw new Error("No wallet account was selected.");
  return getAddress(first);
}

export async function switchToArc(preferred?: EIP1193Provider) {
  await ensureArcMainnet(arcProvider(preferred));
}

export async function arcBalance(address: `0x${string}`) {
  const client = createPublicClient({ chain: arcMainnet, transport: http() });
  const chainId = await client.getChainId();
  if (chainId !== arcMainnet.id) throw new Error("Arc RPC returned an unexpected network. Transactions are blocked.");
  return formatUnits(await client.getBalance({ address }), 18);
}

export async function verifyArcWallet(purpose: "link" | "login", preferred?: EIP1193Provider, allowSignup = false) {
  const provider = arcProvider(preferred);
  const address = await connectArcWallet(provider);
  await ensureArcMainnet(provider);
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  const call = async (body: unknown) => {
    const res = await fetch("/api/public/arc-auth", { method: "POST", headers, body: JSON.stringify(body) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Wallet verification failed.");
    return result;
  };
  const challenge = await call({ action: "challenge", address, purpose, allowSignup });
  const signature = await signArcAuthMessage(provider, address, challenge.message);
  const result = await call({ action: "verify", id: challenge.id, signature, purpose });
  if (purpose === "login") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "magiclink" });
    if (error) throw error;
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw new Error("The account session could not be confirmed.");
  }
  return address;
}

export async function arcPayment(amount: string, recipient: string, preferred?: EIP1193Provider) {
  validateArcPayment(amount, recipient);
  await switchToArc(preferred);
  const address = await connectArcWallet(preferred);
  await arcBalance(address);
  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"), import("@circle-fin/adapter-viem-v2"),
  ]);
  const adapter = await createViemAdapterFromProvider({ provider: arcProvider(preferred) });
  const result = await new AppKit().send({ from: { adapter, chain: "Arc" }, to: getAddress(recipient), amount, token: "USDC" });
  if (result.state === "error") throw new Error(result.errorMessage || "Transfer failed.");
  return result;
}

export async function submitOpenPayArcTransfer(prepared: ArcPreparedTransfer, amount: string, recipient: string, expectedAddress: `0x${string}`, preferred?: EIP1193Provider) {
  verifyArcPreparedTransfer(prepared, amount, recipient);
  await switchToArc(preferred);
  const address = await connectArcWallet(preferred);
  if (address.toLowerCase() !== expectedAddress.toLowerCase()) throw new Error("Wallet account changed. Reconnect and review the payment again.");
  const publicClient = createPublicClient({ chain: arcMainnet, transport: http() });
  if (await publicClient.getChainId() !== arcMainnet.id) throw new Error("Unexpected Arc network.");
  await publicClient.simulateContract({ account: address, address: prepared.transaction.to as `0x${string}`, abi: erc20Abi, functionName: "transfer", args: [getAddress(recipient), parseUnits(amount, 6)] });
  const wallet = createWalletClient({ chain: arcMainnet, transport: custom(arcProvider(preferred)) });
  const txHash = await wallet.sendTransaction({ account: address, to: prepared.transaction.to as `0x${string}`, data: prepared.transaction.data as `0x${string}`, value: 0n });
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
    return { state: receipt.status === "success" ? "success" : "error", txHash };
  } catch { return { state: "pending", txHash }; }
}

export async function bridgeToArc(amount: string, source: "Base" | "Ethereum" | "Arbitrum", preferred?: EIP1193Provider) {
  validateArcPayment(amount);
  const address = await connectArcWallet(preferred);
  await arcBalance(address);
  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"), import("@circle-fin/adapter-viem-v2"),
  ]);
  const adapter = await createViemAdapterFromProvider({ provider: arcProvider(preferred) });
  const result = await new AppKit().bridge({ from: { adapter, chain: source }, to: { adapter, chain: "Arc" }, amount });
  return result;
}

/** Read any ERC-20 balance on Arc Mainnet (e.g. OUSD published by OpenPay Arc). */
export async function arcTokenBalance(address: `0x${string}`, token: `0x${string}`) {
  const client = createPublicClient({ chain: arcMainnet, transport: http() });
  if (await client.getChainId() !== arcMainnet.id) throw new Error("Arc RPC returned an unexpected network.");
  const [raw, decimals] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return formatUnits(raw, decimals);
}

/** Wallet-signed ERC-20 transfer on Arc Mainnet, simulated before signing. */
export async function arcTokenTransfer(token: `0x${string}`, amount: string, recipient: string, preferred?: EIP1193Provider) {
  validateArcPayment(amount, recipient);
  await switchToArc(preferred);
  const address = await connectArcWallet(preferred);
  const publicClient = createPublicClient({ chain: arcMainnet, transport: http() });
  if (await publicClient.getChainId() !== arcMainnet.id) throw new Error("Unexpected Arc network.");
  const decimals = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  const value = parseUnits(amount, decimals);
  const { request } = await publicClient.simulateContract({ account: address, address: token, abi: erc20Abi, functionName: "transfer", args: [getAddress(recipient), value] });
  const wallet = createWalletClient({ chain: arcMainnet, transport: custom(arcProvider(preferred)) });
  const txHash = await wallet.writeContract({ ...request, account: address });
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
    return { state: receipt.status === "success" ? "success" : "error", txHash };
  } catch { return { state: "pending", txHash }; }
}
