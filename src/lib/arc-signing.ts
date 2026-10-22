import { createWalletClient, custom, type Address, type EIP1193Provider, toHex } from "viem";
import { arcMainnet } from "./arc-network";

/** The same selected provider must switch, confirm its chain, and sign. */
export async function ensureArcMainnet(provider: EIP1193Provider) {
  const chainId = toHex(arcMainnet.id);
  const current = await provider.request({ method: "eth_chainId" });
  if (Number(current) === arcMainnet.id) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (Number((error as { code?: number }).code) !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{
      chainId, chainName: arcMainnet.name, nativeCurrency: arcMainnet.nativeCurrency,
      rpcUrls: [...arcMainnet.rpcUrls.default.http],
      blockExplorerUrls: [arcMainnet.blockExplorers.default.url],
    }] });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  }
  if (Number(await provider.request({ method: "eth_chainId" })) !== arcMainnet.id) {
    throw new Error("Switch your wallet to Arc Mainnet before continuing.");
  }
}

export async function signArcAuthMessage(provider: EIP1193Provider, address: Address, message: string) {
  if (!message.split("\n").includes(`Chain ID: ${arcMainnet.id}`)) {
    throw new Error("Wallet sign-in requires an Arc Mainnet challenge.");
  }
  await ensureArcMainnet(provider);
  const accounts = await provider.request({ method: "eth_accounts" });
  if (accounts[0]?.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Wallet account changed. Reconnect before signing in.");
  }
  const wallet = createWalletClient({ chain: arcMainnet, transport: custom(provider, { retryCount: 0 }) });
  return wallet.signMessage({ account: address, message });
}