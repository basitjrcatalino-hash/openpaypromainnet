import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import logoAsset from "@/assets/openpay-pro-logo.png.asset.json";
import { formatNumber } from "@/lib/wallet-utils";

export type ShareTokenData = {
  symbol: string;
  name: string;
  logoUrl?: string | null;
  price: number;
  change24h?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
  network?: string | null;
  url?: string;
};

const ACCENT = "#ab9ff2";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function compact(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

async function drawTokenCard(canvas: HTMLCanvasElement, d: ShareTokenData) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#12111a");
  grad.addColorStop(0.55, "#0b0b0f");
  grad.addColorStop(1, "#181430");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.8, H * 0.18, 10, W * 0.8, H * 0.18, 640);
  glow.addColorStop(0, "rgba(171,159,242,0.32)");
  glow.addColorStop(1, "rgba(171,159,242,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "top";

  const [brand, token] = await Promise.all([
    loadImage(logoAsset.url),
    d.logoUrl ? loadImage(d.logoUrl) : Promise.resolve(null),
  ]);

  if (brand) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 120, 40, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(brand, 80, 80, 80, 80);
    ctx.restore();
  }
  ctx.fillStyle = ACCENT;
  ctx.font = "800 40px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("OpenPay Pro", 184, 88);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.fillText(d.network ? `${d.network} · Token` : "Token", 184, 140);

  // Token identity
  if (token) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(140, 350, 60, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(token, 80, 290, 120, 120);
    ctx.restore();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 68px Inter, system-ui, sans-serif";
  ctx.fillText(d.symbol.toUpperCase(), token ? 232 : 80, 292);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 32px Inter, system-ui, sans-serif";
  ctx.fillText(d.name, token ? 236 : 84, 372);

  // Price
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 132px Inter, system-ui, sans-serif";
  ctx.fillText(
    `$${formatNumber(d.price, d.price >= 1 ? 2 : 6)}`,
    80,
    492,
  );

  const chg = Number(d.change24h ?? 0);
  const up = chg >= 0;
  const col = up ? "#34d399" : "#fb7185";
  const chgLabel = `${up ? "+" : ""}${chg.toFixed(2)}%  24h`;
  ctx.font = "800 40px Inter, system-ui, sans-serif";
  const pw = ctx.measureText(chgLabel).width + 56;
  ctx.fillStyle = up ? "rgba(52,211,153,0.16)" : "rgba(251,113,133,0.16)";
  ctx.beginPath();
  ctx.roundRect(80, 660, pw, 76, 38);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.fillText(chgLabel, 108, 678);

  const rows: [string, string][] = [
    ["Market cap", compact(d.marketCap)],
    ["24h volume", compact(d.volume24h)],
    ["Network", d.network || "OpenPay"],
    ["Date", new Date().toLocaleDateString()],
  ];

  let y = 840;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.roundRect(80, y - 30, W - 160, rows.length * 76 + 44, 32);
  ctx.fill();
  for (const [k, v] of rows) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 30px Inter, system-ui, sans-serif";
    ctx.fillText(k, 120, y + 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 32px Inter, system-ui, sans-serif";
    const tw = ctx.measureText(v).width;
    ctx.fillText(v, W - 120 - tw, y + 10);
    y += 76;
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 28px Inter, system-ui, sans-serif";
  ctx.fillText("Trade this token on openpaypro.space", 80, H - 120);
}

export function ShareTokenDialog({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: ShareTokenData;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const pageUrl = useMemo(() => {
    if (data.url) return data.url;
    if (typeof window !== "undefined") return window.location.href;
    return "https://openpaypro.space";
  }, [data.url]);

  const text = useMemo(
    () =>
      `${data.symbol.toUpperCase()} is at $${formatNumber(data.price, data.price >= 1 ? 2 : 6)} (${
        Number(data.change24h ?? 0) >= 0 ? "+" : ""
      }${Number(data.change24h ?? 0).toFixed(2)}% 24h) on OpenPay Pro`,
    [data.symbol, data.price, data.change24h],
  );

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    let active = true;
    void drawTokenCard(c, data).then(() => {
      if (active) setUrl(c.toDataURL("image/png"));
    });
    return () => {
      active = false;
    };
  }, [open, data]);

  const fileName = `openpaypro-${data.symbol.toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}.png`;

  const blob = async (): Promise<Blob | null> =>
    new Promise((res) => canvasRef.current?.toBlob((b) => res(b), "image/png") ?? res(null));

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const share = async () => {
    const b = await blob();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (b) {
      const file = new File([b], fileName, { type: "image/png" });
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${data.symbol} on OpenPay Pro`, text, url: pageUrl });
          return;
        } catch {
          return;
        }
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.symbol} on OpenPay Pro`, text, url: pageUrl });
        return;
      } catch {
        return;
      }
    }
    download();
    toast.success("Image saved — share it anywhere");
  };

  const copyImage = async () => {
    const b = await blob();
    if (!b) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      toast.success("Card copied to clipboard");
    } catch {
      download();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const socials: { key: string; label: string; href: string }[] = [
    {
      key: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`,
    },
    {
      key: "tg",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`,
    },
    {
      key: "wa",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${pageUrl}`)}`,
    },
    {
      key: "fb",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-4">
        <DialogTitle className="text-center text-base">Share {data.symbol.toUpperCase()}</DialogTitle>
        <canvas ref={canvasRef} className="hidden" />
        {url ? (
          <img
            src={url}
            alt={`${data.symbol} share card`}
            className="mx-auto w-full rounded-2xl border border-border shadow-xl"
          />
        ) : (
          <div className="mx-auto aspect-[4/5] w-full animate-pulse rounded-2xl bg-muted" />
        )}

        <div className="grid grid-cols-4 gap-2">
          {socials.map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="grid h-10 place-items-center rounded-xl border border-border text-xs font-medium hover:bg-muted"
            >
              {s.label}
            </a>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="h-10 rounded-xl text-xs" onClick={() => void copyLink()}>
            <Link2 className="mr-1 h-3.5 w-3.5" /> Link
          </Button>
          <Button variant="outline" className="h-10 rounded-xl text-xs" onClick={() => void copyImage()}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
          <Button variant="outline" className="h-10 rounded-xl text-xs" onClick={download}>
            <Download className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
          <Button className="h-10 rounded-xl text-xs" onClick={() => void share()}>
            <Share2 className="mr-1 h-3.5 w-3.5" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
