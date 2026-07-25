// OpenPay account linking + sync — client helpers backed by server functions.
import {
  getOpenPayLinkStatus,
  linkOpenPayAccount,
  unlinkOpenPayAccount,
  syncOpenPayOUSD,
  type OpenPayLinkRecord,
} from "@/lib/openpay-pro.functions";

export type OpenPayUser = { id: string; email: string; displayName: string };
export type OpenPayWalletLink = {
  linked: boolean;
  openpayUserId?: string;
  username?: string;
  account_number?: string;
  name?: string;
  email?: string;
  identifier?: string;
  source?: "partner" | "local";
  linkedAt?: string;
};

function toLink(r: OpenPayLinkRecord): OpenPayWalletLink {
  return {
    linked: !!r.linked,
    openpayUserId: r.openpayUserId,
    username: r.username,
    account_number: r.account_number,
    name: r.name,
    email: r.email,
    identifier: r.identifier,
    source: r.source,
    linkedAt: r.linkedAt,
  };
}

export const openpay = {
  async getStatus(): Promise<OpenPayWalletLink> {
    const status = await getOpenPayLinkStatus();
    return toLink(status);
  },

  async linkAccount(identifier: string): Promise<OpenPayWalletLink> {
    const linked = await linkOpenPayAccount({ data: { identifier } });
    return toLink(linked);
  },

  async unlink(): Promise<void> {
    await unlinkOpenPayAccount();
  },

  async syncOUSD(
    walletId: string,
  ): Promise<{ balance: number; synced?: boolean; message?: string }> {
    return syncOpenPayOUSD({ data: { walletId } });
  },

  async requestPayment(amount: number, memo?: string): Promise<{ qr: string; reference: string }> {
    const reference = `pay_${Date.now()}`;
    return {
      qr: `openpay://pay?amount=${amount}&ref=${reference}${memo ? `&memo=${encodeURIComponent(memo)}` : ""}`,
      reference,
    };
  },
};
