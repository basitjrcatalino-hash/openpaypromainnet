// ConnectKit + wagmi v2 connect modal (OpenPay Arc setup). Browser-only:
// loaded lazily from arc-connect-dialog so it never runs during SSR.
import { useEffect, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { WagmiProvider, createConfig, http, useAccount } from "wagmi";
import { mainnet, base, arbitrum } from "viem/chains";
import { arcMainnet } from "@/lib/arc-network";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, useModal } from "connectkit";

const WC_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ??
  (import.meta.env.VITE_WALLETCONNECT_PAY_APP_ID as string | undefined) ??
  "";

let cfg: ReturnType<typeof createConfig> | null = null;
function getConfig() {
  if (cfg) return cfg;
  const origin = window.location.origin;
  cfg = createConfig({
    chains: [arcMainnet, mainnet, base, arbitrum],
    connectors: [
      injected({ shimDisconnect: true }),
      ...(WC_PROJECT_ID
        ? [walletConnect({
            projectId: WC_PROJECT_ID,
            metadata: { name: "OpenPay Pro", description: "USDC Wallet powered by Circle · Arc", url: origin, icons: [`${origin}/favicon.png`] },
            showQrModal: false,
          })]
        : []),
      coinbaseWallet({ appName: "OpenPay Pro", appLogoUrl: `${origin}/favicon.png` }),
    ],
    transports: {
      [arcMainnet.id]: http(),
      [mainnet.id]: http(),
      [base.id]: http(),
      [arbitrum.id]: http(),
    },
  });
  return cfg;
}

const queryClient = new QueryClient();

const theme = {
  "--ck-font-family": "inherit",
  "--ck-border-radius": "20px",
  "--ck-overlay-background": "rgba(15,23,42,0.5)",
  "--ck-modal-box-shadow": "0 25px 50px rgba(0,0,0,0.15)",
  "--ck-body-background": "#ffffff",
  "--ck-body-background-secondary": "#f8faff",
  "--ck-body-background-tertiary": "#eff6ff",
  "--ck-body-color": "#0f172a",
  "--ck-body-color-muted": "#64748b",
  "--ck-body-color-muted-hover": "#475569",
  "--ck-primary-button-background": "#1d2f50",
  "--ck-primary-button-hover-background": "#1e3a6e",
  "--ck-primary-button-color": "#ffffff",
  "--ck-primary-button-border-radius": "16px",
  "--ck-secondary-button-background": "#eff6ff",
  "--ck-secondary-button-hover-background": "#dbeafe",
  "--ck-secondary-button-color": "#2563eb",
  "--ck-secondary-button-border-radius": "16px",
  "--ck-focus-color": "#2563eb",
  "--ck-body-divider": "#e2e8f0",
  "--ck-spinner-color": "#2563eb",
  "--ck-body-action-color": "#2563eb",
  "--ck-body-color-danger": "#dc2626",
  "--ck-wallet-option-border-radius": "14px",
};

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (p: EIP1193Provider) => void };

function Bridge({ open, onOpenChange, onSelect }: Props) {
  const { status, connector } = useAccount();
  const { open: modalOpen, setOpen } = useModal();
  const wasOpen = useRef(false);
  const handled = useRef(false);
  const setModalOpen = useRef(setOpen);
  setModalOpen.current = setOpen;

  useEffect(() => {
    handled.current = false;
    // ConnectKit closes its modal in a mount effect; open after that initialization.
    const frame = window.requestAnimationFrame(() => setModalOpen.current(open));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (modalOpen) wasOpen.current = true;
    else if (wasOpen.current) { wasOpen.current = false; onOpenChange(false); }
  }, [modalOpen, onOpenChange]);

  useEffect(() => {
    if (!open || status !== "connected" || !connector || handled.current) return;
    handled.current = true;
    void (async () => {
      const provider = (await connector.getProvider()) as EIP1193Provider;
      setOpen(false);
      onOpenChange(false);
      onSelect(provider);
    })();
  }, [open, status, connector, setOpen, onOpenChange, onSelect]);

  return null;
}

export default function ArcConnectKit(props: Props) {
  const [config] = useState(getConfig);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="auto" mode="light" customTheme={theme} options={{ initialChainId: arcMainnet.id }}>
          <Bridge {...props} />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
