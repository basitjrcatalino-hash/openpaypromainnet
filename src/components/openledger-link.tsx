import { ExternalLink } from "lucide-react";

export const OPENLEDGER_BASE = "https://www.openpyledger.space";

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

/** Exact Pro ledger entry page, e.g. /pro/entry/{uuid}. */
export function openLedgerProEntryUrl(idOrSequence: string | number): string {
  return `${OPENLEDGER_BASE}/pro/entry/${idOrSequence}`;
}

/**
 * Resolve the best OpenLedger deep-link for a Pro wallet tx.
 * Prefer the entry UUID → exact `/pro/entry/{uuid}` detail page.
 * Fall back to sequence, then SHA-256 `/tx/{hash}`.
 */
export function resolveOpenLedgerHref(opts: {
  hash?: string | null;
  proEntryId?: string | null;
  proSequence?: number | null;
}): string | null {
  if (opts.proEntryId) return openLedgerProEntryUrl(opts.proEntryId);
  if (opts.proSequence != null && Number.isFinite(Number(opts.proSequence))) {
    return openLedgerProEntryUrl(Number(opts.proSequence));
  }
  if (opts.hash && isOpenLedgerHash(opts.hash)) return openLedgerTxUrl(opts.hash);
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
