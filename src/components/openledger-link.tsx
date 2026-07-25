import { ExternalLink } from "lucide-react";

export const OPENLEDGER_BASE = "https://openledger.lovable.app";

/** OpenLedger SHA-256 ledger hash (64 hex), with or without 0x. */
export function isOpenLedgerHash(value: string | null | undefined): boolean {
  if (!value) return false;
  const h = value.trim().replace(/^0x/i, "");
  return /^[a-fA-F0-9]{64}$/.test(h);
}

export function openLedgerTxUrl(hash: string): string {
  const h = hash.trim().replace(/^0x/i, "").toLowerCase();
  return `${OPENLEDGER_BASE}/tx/${h}`;
}

/** Exact Pro ledger entry page — prefer numeric sequence (e.g. /pro/entry/28). */
export function openLedgerProEntryUrl(idOrSequence: string | number): string {
  return `${OPENLEDGER_BASE}/pro/entry/${idOrSequence}`;
}

/**
 * Resolve the best OpenLedger deep-link for a Pro wallet tx.
 * Prefer sequence → exact `/pro/entry/{n}` detail page on OpenLedger.
 * Fall back to SHA-256 `/tx/{hash}`, then UUID id.
 */
export function resolveOpenLedgerHref(opts: {
  hash?: string | null;
  proEntryId?: string | null;
  proSequence?: number | null;
}): string | null {
  if (opts.proSequence != null && Number.isFinite(Number(opts.proSequence))) {
    return openLedgerProEntryUrl(Number(opts.proSequence));
  }
  if (opts.hash && isOpenLedgerHash(opts.hash)) return openLedgerTxUrl(opts.hash);
  if (opts.proEntryId) return openLedgerProEntryUrl(opts.proEntryId);
  return null;
}

export function OpenLedgerLink({
  hash,
  proEntryId,
  proSequence,
  className,
}: {
  hash?: string | null;
  proEntryId?: string | null;
  proSequence?: number | null;
  className?: string;
}) {
  const href = resolveOpenLedgerHref({ hash, proEntryId, proSequence });
  if (!href) return null;

  const seq =
    proSequence != null && Number.isFinite(Number(proSequence))
      ? Number(proSequence)
      : null;
  const label =
    seq != null ? `View on OpenLedger #${seq}` : "View on OpenLedger";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted/60"
      }
    >
      <ExternalLink className="h-4 w-4" />
      {label}
    </a>
  );
}
