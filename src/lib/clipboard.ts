/**
 * Copy text to the clipboard with a fallback for contexts where the
 * async Clipboard API is unavailable (iframes, insecure origins, or
 * browsers that deny clipboard permissions).
 *
 * Throws when every method fails, so callers can keep try/catch + toast UX.
 */
export async function copyText(text: string): Promise<void> {
  // Preferred: async Clipboard API (requires secure context + permission).
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to execCommand fallback
    }
  }

  // Fallback: hidden textarea + document.execCommand("copy").
  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2px";
    ta.style.height = "2px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    document.body.appendChild(ta);

    const active = document.activeElement as HTMLElement | null;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    // Restore focus so keyboard UX isn't broken.
    active?.focus?.();

    if (ok) return;
  }

  throw new Error("Clipboard copy is not available in this context");
}
