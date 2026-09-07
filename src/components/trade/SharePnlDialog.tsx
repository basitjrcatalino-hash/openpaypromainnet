import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/openpay-pro-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";

export type SharePnl = {
  market: string;
  side: string;
  leverage?: number | null;
  entryPrice?: number | null;
  markPrice?: number | null;
  pnl?: number | null;
  pnlPct?: number | null;
  amount?: number | null;
  quote?: string;
  mode: "spot" | "futures";
  at?: string;
};

const ACCENT = "#ab9ff2";

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = logoAsset.url;
  });
}

async function drawCard(canvas: HTMLCanvasElement, d: SharePnl) {
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

  // glow
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.15, 10, W * 0.8, H * 0.15, 620);
  glow.addColorStop(0, "rgba(171,159,242,0.35)");
  glow.addColorStop(1, "rgba(171,159,242,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const up = Number(d.pnl ?? d.pnlPct ?? 0) >= 0;
  const col = up ? "#34d399" : "#fb7185";

  ctx.textBaseline = "top";
  const logo = await loadLogo();
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 120, 40, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, 80, 80, 80, 80);
    ctx.restore();
  }
  ctx.fillStyle = ACCENT;
  ctx.font = "800 40px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("OpenPay Pro", 184, 88);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.fillText(d.mode === "futures" ? "Perpetual Futures" : "Spot Trade", 184, 140);

  // pill
  const label = `${d.side.toUpperCase()}${d.leverage ? `  ${d.leverage}×` : ""}`;
  ctx.font = "800 34px Inter, system-ui, sans-serif";
  const pw = ctx.measureText(label).width + 56;
  ctx.fillStyle = up ? "rgba(52,211,153,0.16)" : "rgba(251,113,133,0.16)";
  ctx.beginPath();
  ctx.roundRect(80, 280, pw, 68, 34);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.fillText(label, 108, 296);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 78px Inter, system-ui, sans-serif";
  ctx.fillText(`${d.market}/${d.quote ?? "OUSD"}`, 80, 388);

  const pct = Number(d.pnlPct ?? 0);
  ctx.fillStyle = col;
  ctx.font = "900 170px Inter, system-ui, sans-serif";
  ctx.fillText(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`, 80, 520);

  if (d.pnl != null) {
    ctx.font = "700 52px Inter, system-ui, sans-serif";
    ctx.fillText(
      `${Number(d.pnl) >= 0 ? "+" : ""}${formatNumber(Number(d.pnl), 2)} ${d.quote ?? "OUSD"}`,
      80,
      724,
    );
  }

  const rows: [string, string][] = [];
  if (d.entryPrice) rows.push(["Entry price", formatNumber(d.entryPrice, 4)]);
  if (d.markPrice) rows.push([d.mode === "futures" ? "Mark price" : "Exit price", formatNumber(d.markPrice, 4)]);
  if (d.amount) rows.push(["Size", `${formatNumber(d.amount, 6)} ${d.market}`]);
  rows.push(["Date", new Date(d.at ?? Date.now()).toLocaleString()]);

  let y = 860;
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
  ctx.fillText("Trade spot & futures on openpaypro.space", 80, H - 120);
}

export function SharePnlPage({ data, onBack }: { data: SharePnl; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let active = true;
    void drawCard(c, data).then(() => {
      if (active) setUrl(c.toDataURL("image/png"));
    });
    return () => {
      active = false;
    };
  }, [data]);

  const fileName = useMemo(
    () => `openpaypro-${data.market}-pnl-${new Date().toISOString().slice(0, 10)}.png`,
    [data.market],
  );

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
    if (!b) return;
    const file = new File([b], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "My OpenPay Pro trade",
          text: `${data.side.toUpperCase()} ${data.market} on OpenPay Pro`,
        });
        return;
      } catch {
        return;
      }
    }
    download();
    toast.success("Image saved — share it anywhere");
  };

  const copy = async () => {
    const b = await blob();
    if (!b) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      toast.success("Copied to clipboard");
    } catch {
      download();
    }
  };

  const up = Number(data.pnl ?? data.pnlPct ?? 0) >= 0;

  return (
    <main className="min-h-dvh bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-5 grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
          <Button type="button" variant="ghost" size="icon" aria-label="Back to trade" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-center gap-2">
            <img src={logoAsset.url} alt="OpenPay Pro" className="h-7 w-7 rounded-full object-contain" />
            <h1 className="text-base font-bold">Share PnL</h1>
          </div>
          <span aria-hidden="true" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {url ? (
          <img
            src={url}
            alt={`${data.market} PnL card`}
            className={cn(
              "mx-auto w-full max-w-sm rounded-2xl border shadow-2xl",
              up ? "border-emerald-500/30" : "border-rose-500/30",
            )}
          />
        ) : null}
        <div className="mx-auto mt-5 grid w-full max-w-sm grid-cols-3 gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-xl text-xs" onClick={copy}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
          <Button type="button" variant="outline" className="h-10 rounded-xl text-xs" onClick={download}>
            <Download className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
          <Button type="button" className="h-10 rounded-xl text-xs" onClick={() => void share()}>
            <Share2 className="mr-1 h-3.5 w-3.5" /> Share
          </Button>
        </div>
      </div>
    </main>
  );
}
