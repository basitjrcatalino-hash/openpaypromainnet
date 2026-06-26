// Stubbed OpenPay API integration layer.
// Replace these implementations with real HTTP calls once API access is provided.

export type OpenPayUser = { id: string; email: string; displayName: string };
export type OpenPayWalletLink = { linked: boolean; openpayUserId?: string };

export const openpay = {
  async getStatus(): Promise<OpenPayWalletLink> {
    return { linked: false };
  },
  async linkAccount(_email: string): Promise<OpenPayWalletLink> {
    await new Promise((r) => setTimeout(r, 600));
    return { linked: true, openpayUserId: "op_" + Math.random().toString(36).slice(2, 10) };
  },
  async unlink(): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));
  },
  async syncOUSD(_walletId: string): Promise<{ balance: number }> {
    return { balance: 0 };
  },
  async requestPayment(amount: number, _memo?: string): Promise<{ qr: string; reference: string }> {
    return { qr: `openpay://pay?amount=${amount}&ref=${Date.now()}`, reference: String(Date.now()) };
  },
};
