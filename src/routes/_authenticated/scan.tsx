import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardPaste,
  Copy,
  Flashlight,
  FlashlightOff,
  ImageIcon,
  Loader2,
  QrCode,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { copyText as copyToClipboardRobust } from "@/lib/clipboard";

import { supabase } from "@/integrations/supabase/client";
import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { isWalletConnectPayLink, normalizeWalletConnectPayLink } from "@/lib/walletconnect-pay";
import { isEmbeddedFrame, scanQrFromFile, usePhantomQrScanner } from "@/lib/qr-camera";
import { buildReceiveQrPayload, walletQrDataUrl } from "@/lib/receive-qr";
import { shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scan")({
  ssr: false,
  head: () => ({ meta: [{ title: "Scan — OpenPay Pro" }] }),
  component: ScanPage,
});

const FALLBACK_EL_ID = "openpay-qr-fallback";

function ScanPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handled = useRef(false);
  const alive = useRef(true);
  const finishRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const [flash, setFlash] = useState(false);
  /** My QR overlay — stay on /scan (avoids receive showing under scanner). */
  const [showMyQr, setShowMyQr] = useState(false);
  const [myQrUrl, setMyQrUrl] = useState("");

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("id, name, address")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const qrPayload = wallet?.address
    ? buildReceiveQrPayload({ address: wallet.address, asset: "OUSD" })
    : "";

  useEffect(() => {
    let cancelled = false;
    if (!qrPayload) {
      setMyQrUrl("");
      return;
    }
    void walletQrDataUrl(qrPayload, 280).then((url) => {
      if (!cancelled) setMyQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  // Pause camera while My QR sheet is open so it doesn't fight the overlay.
  const scanner = usePhantomQrScanner({
    videoRef,
    fallbackElId: FALLBACK_EL_ID,
    active: !showMyQr,
    onResult: (text) => {
      if (handled.current || showMyQr) return;
      handled.current = true;
      void finishRef.current(text);
    },
  });

  finishRef.current = async (text: string) => {
    setFlash(true);
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(30);
      }
    } catch {
      /* ignore */
    }

    if (isWalletConnectPayLink(text)) {
      if (alive.current) toast.success("WalletConnect Pay link scanned");
      void navigate({
        to: "/wc-pay",
        search: { link: normalizeWalletConnectPayLink(text) },
      });
      return;
    }

    const parsed = parsePaymentQr(text);
    if (!parsed.to) {
      handled.current = false;
      scanner.unlock();
      setFlash(false);
      const preview = text.trim().slice(0, 48);
      if (alive.current) {
        toast.error(
          preview
            ? `QR has no payment address (${preview}${text.trim().length > 48 ? "…" : ""})`
            : "QR decoded empty — try Photos or hold steadier",
        );
      }
      return;
    }

    // /scan is for OpenPay Pro wallet receive QRs (0x…) across all Pro tokens.
    // Also accept legacy HTTPS /pay/ links that still decode to a Pro address.
    const isPro =
      parsed.kind === "pro_wallet" || /^0x[a-fA-F0-9]{40}$/i.test(parsed.to.trim());
    if (!isPro) {
      handled.current = false;
      scanner.unlock();
      setFlash(false);
      if (alive.current) {
        toast.error(
          "Scan an OpenPay Pro wallet receive QR (any token). OpenPay @handles use Send → OpenPay.",
        );
      }
      return;
    }

    if (alive.current) {
      const label = parsed.token
        ? "OpenPay Pro token QR scanned"
        : parsed.asset
          ? `OpenPay Pro ${parsed.asset} QR scanned`
          : "OpenPay Pro wallet scanned";
      toast.success(label);
    }

    const sendSearch: {
      to: string;
      rail: "wallet";
      amount?: string;
      token?: string;
      asset?:
        | "OUSD"
        | "PI"
        | "BTC"
        | "ETH"
        | "SOL"
        | "USDC"
        | "USDT"
        | "PYUSD"
        | "USDG"
        | "USD1"
        | "CASH"
        | "EURC";
    } = {
      to: parsed.to,
      rail: "wallet",
      ...(parsed.amount ? { amount: parsed.amount } : {}),
    };

    if (parsed.token) {
      sendSearch.token = parsed.token;
    } else {
      sendSearch.asset = parsed.asset ?? "OUSD";
    }

    void navigate({
      to: "/send",
      search: sendSearch,
    });
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function onPickImage(file: File) {
    try {
      const decoded = await scanQrFromFile(file);
      if (handled.current) return;
      handled.current = true;
      await finishRef.current(decoded);
    } catch {
      toast.error("No QR code found in image");
    }
  }

  async function onPaste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.error("Clipboard is empty");
        return;
      }
      if (handled.current) return;
      handled.current = true;
      await finishRef.current(text);
    } catch {
      toast.error("Couldn’t read clipboard — allow paste permission");
    }
  }

  async function onTorch() {
    if (!scanner.torchSupported) {
      toast.error("Flashlight not available on this device");
      return;
    }
    try {
      await scanner.toggleTorch();
    } catch {
      toast.error("Flashlight not available");
    }
  }

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await copyToClipboardRobust(wallet.address);
      toast.success("Address copied");
    } catch {
      toast.error("Couldn’t copy");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-300",
          scanner.mode !== "native" && "invisible",
          (scanner.starting || showMyQr) && "opacity-0",
        )}
        playsInline
        muted
        autoPlay
      />

      <div
        id={FALLBACK_EL_ID}
        className={cn(
          "absolute inset-0 z-0 h-full w-full overflow-hidden bg-black [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:max-w-none [&_video]:object-cover",
          (scanner.mode !== "fallback" || showMyQr) && "invisible pointer-events-none",
        )}
        aria-hidden
      />

      {/* Success flash */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-200",
          flash ? "opacity-40" : "opacity-0",
        )}
      />

      {/* Dim mask with square cutout */}
      {!showMyQr && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
          <div className="w-full flex-1 bg-black/60" />
          <div className="flex w-full items-stretch">
            <div className="flex-1 bg-black/60" />
            <div className="relative h-[min(72vw,18.5rem)] w-[min(72vw,18.5rem)] shrink-0">
              <span className="ph-scan-bracket absolute -left-0.5 -top-0.5 h-11 w-11 rounded-tl-[1.15rem] border-l-[3.5px] border-t-[3.5px] border-white" />
              <span className="ph-scan-bracket absolute -right-0.5 -top-0.5 h-11 w-11 rounded-tr-[1.15rem] border-r-[3.5px] border-t-[3.5px] border-white [animation-delay:60ms]" />
              <span className="ph-scan-bracket absolute -bottom-0.5 -left-0.5 h-11 w-11 rounded-bl-[1.15rem] border-b-[3.5px] border-l-[3.5px] border-white [animation-delay:120ms]" />
              <span className="ph-scan-bracket absolute -bottom-0.5 -right-0.5 h-11 w-11 rounded-br-[1.15rem] border-b-[3.5px] border-r-[3.5px] border-white [animation-delay:180ms]" />
              {!scanner.error && !scanner.starting && (
                <div className="ph-scan-line absolute inset-x-3 h-0.5 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.85)]" />
              )}
            </div>
            <div className="flex-1 bg-black/60" />
          </div>
          <div className="w-full flex-1 bg-black/60" />
        </div>
      )}

      {/* Top chrome */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            if (showMyQr) {
              setShowMyQr(false);
              return;
            }
            navigate({ to: "/dashboard" });
          }}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/12 backdrop-blur-md press"
          aria-label={showMyQr ? "Close My QR" : "Close scanner"}
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <div className="text-[15px] font-bold tracking-tight">
          {showMyQr ? "My QR code" : "Scan a QR code"}
        </div>
        <div className="w-11" />
      </div>

      {/* Starting */}
      {!showMyQr && scanner.starting && !scanner.error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="text-sm font-medium text-white/80">Starting camera…</p>
          </div>
        </div>
      )}

      {/* My QR overlay — Phantom-style sheet over paused scan */}
      {showMyQr && (
        <div className="absolute inset-0 z-[25] flex flex-col items-center justify-center bg-black px-6 pb-28 pt-20">
          <div className="w-full max-w-sm rounded-[1.75rem] bg-white p-6 text-center text-black shadow-2xl">
            <p className="text-sm font-semibold text-neutral-500">Receive on OpenPay Pro</p>
            <p className="mt-1 text-lg font-bold">OpenPay Pro</p>
            {myQrUrl ? (
              <img
                src={myQrUrl}
                alt="Receive QR"
                className="mx-auto mt-5 h-52 w-52 rounded-2xl"
              />
            ) : (
              <div className="mx-auto mt-5 grid h-52 w-52 place-items-center rounded-2xl bg-neutral-100">
                <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
              </div>
            )}
            <p className="mt-4 break-all font-mono text-xs text-neutral-600">
              {wallet?.address ? shortAddress(wallet.address, 10, 10) : "No wallet"}
            </p>
            <p className="mt-1 text-[11px] text-neutral-400">
              {wallet?.name ?? "Main Wallet"}
            </p>
            <button
              type="button"
              onClick={() => void copyAddress()}
              disabled={!wallet?.address}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-sm font-bold text-white press disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              Copy address
            </button>
          </div>
          <p className="mt-5 max-w-xs text-center text-[13px] text-white/60">
            This QR is your wallet address. Scan it in OpenPay Pro → Send, or copy the address below
          </p>
        </div>
      )}

      {/* Bottom chrome — Phantom: Photos · My QR · Light · Paste */}
      <div className="absolute inset-x-0 bottom-0 z-30 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {!showMyQr && (
          <p className="mx-auto mb-7 max-w-xs text-center text-[13px] font-medium leading-snug text-white/65">
            Scan a wallet address QR — opens Send with the address filled in
          </p>
        )}

        <div className="mx-auto flex max-w-sm items-start justify-around">
          <ScanAction
            label="Photos"
            onClick={() => fileRef.current?.click()}
            icon={<ImageIcon className="h-5 w-5" strokeWidth={1.85} />}
          />
          <ScanAction
            label="My QR"
            onClick={() => setShowMyQr((v) => !v)}
            icon={<QrCode className="h-5 w-5" strokeWidth={1.85} />}
            active={showMyQr}
          />
          <ScanAction
            label={scanner.torchOn ? "Light off" : "Light"}
            onClick={() => void onTorch()}
            icon={
              scanner.torchOn ? (
                <FlashlightOff className="h-5 w-5" strokeWidth={1.85} />
              ) : (
                <Flashlight className="h-5 w-5" strokeWidth={1.85} />
              )
            }
            active={scanner.torchOn}
          />
          <ScanAction
            label="Paste"
            onClick={() => void onPaste()}
            icon={<ClipboardPaste className="h-5 w-5" strokeWidth={1.85} />}
          />
        </div>

        {!showMyQr && scanner.error && (
          <div className="mt-5 space-y-3 text-center">
            <p className="text-sm text-red-300">{scanner.error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handled.current = false;
                  scanner.restart();
                }}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black press"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full bg-white/14 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md press"
              >
                Scan photo
              </button>
              {isEmbeddedFrame() && (
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, "_blank", "noopener")}
                  className="rounded-full bg-white/14 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md press"
                >
                  Open in new tab
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickImage(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ScanAction({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-16 flex-col items-center gap-2 text-[11px] font-semibold tracking-tight text-white/90 press"
    >
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full backdrop-blur-md transition-colors",
          active ? "bg-white text-black" : "bg-white/14 text-white",
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
