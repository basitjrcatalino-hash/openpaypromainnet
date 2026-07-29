import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** Bags Cash money-bag mark — always Bags green. */
export function BagsCashIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#34d399"
      aria-hidden
      className={cn("h-5 w-5 shrink-0", className)}
      {...props}
    >
      <path d="M12 2.4c-.9 0-1.7.4-2.2 1.1L8.4 5.2H6.8c-.9 0-1.6.7-1.6 1.6v1.1c-1.4.5-2.4 1.9-2.4 3.5v5.8c0 2.4 1.9 4.4 4.4 4.4h9.6c2.4 0 4.4-2 4.4-4.4v-5.8c0-1.6-1-3-2.4-3.5V6.8c0-.9-.7-1.6-1.6-1.6h-1.6l-1.4-1.7C13.7 2.8 12.9 2.4 12 2.4Zm-1.5 3.5.7-.9c.2-.2.5-.4.8-.4s.6.1.8.4l.7.9H10.5Zm-3.7 2.9h10.4v.7c0 .3.2.5.5.6 1 .3 1.7 1.2 1.7 2.2v5.8c0 1.3-1.1 2.4-2.4 2.4H7.2c-1.3 0-2.4-1.1-2.4-2.4v-5.8c0-1 .7-1.9 1.7-2.2.3-.1.5-.3.5-.6V8.8Zm4.2 3.2c-1.5 0-2.6.9-2.6 2.3 0 1.1.7 1.9 1.8 2.2v.8h1.6v-.8c1.1-.3 1.8-1.1 1.8-2.2h-1.4c0 .5-.3.8-.8.8s-.9-.3-.9-.9.4-.9.9-.9 1.1.2 1.6.5c.7-.5 1.1-1.2 1.1-2.1 0-1.4-1.1-2.3-2.6-2.3Zm0 1.3c.4 0 .8.2.8.7s-.4.7-.8.7-.8-.2-.8-.7.4-.7.8-.7Z" />
    </svg>
  );
}
