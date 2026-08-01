import { toast, type ExternalToast } from "sonner";

import { playUiSound, type UiSoundKind } from "@/lib/p2p-sounds";

type Opts = ExternalToast & { sound?: UiSoundKind | false };

/**
 * Phantom-style confirm: play a success chime + toast.
 * Use for top-up, sell, swap, withdraw, send, and other money moves.
 */
export function notifySuccess(message: string, opts?: Opts) {
  const { sound = "success", duration = 4800, ...toastOpts } = opts ?? {};
  if (sound !== false) playUiSound(sound);
  return toast.success(message, { duration, ...toastOpts });
}

export function notifyInfo(message: string, opts?: Opts) {
  const { sound = "notify", duration = 4800, ...toastOpts } = opts ?? {};
  if (sound !== false) playUiSound(sound);
  return toast(message, { duration, ...toastOpts });
}
