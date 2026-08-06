/**
 * Device biometrics (Face ID / Touch ID / Android fingerprint) via WebAuthn
 * platform authenticators. The credential id is stored locally per user so the
 * app-lock screen can request a biometric assertion instead of a password.
 */

const CRED_KEY = (userId: string) => `openpay-pro-biometric-cred:${userId}`;

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(v: string): Uint8Array {
  const bin = atob(v);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials?.create
  );
}

/** True when the device exposes a built-in (platform) authenticator. */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getStoredCredentialId(userId: string): string | null {
  try {
    return localStorage.getItem(CRED_KEY(userId));
  } catch {
    return null;
  }
}

export function hasBiometricCredential(userId: string): boolean {
  return !!getStoredCredentialId(userId);
}

export function clearBiometricCredential(userId: string) {
  try {
    localStorage.removeItem(CRED_KEY(userId));
  } catch {
    /* ignore */
  }
}

/** Enroll this device's biometric. Throws on cancel / unsupported. */
export async function registerBiometric(userId: string, label: string): Promise<void> {
  if (!isBiometricSupported()) throw new Error("Biometrics are not supported on this device");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const rawUserId = new TextEncoder().encode(userId).slice(0, 64);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "OpenPay Pro" },
      user: { id: rawUserId, name: label || "OpenPay user", displayName: label || "OpenPay user" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        userVerification: "required",
        authenticatorAttachment: "platform",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric setup was cancelled");
  localStorage.setItem(CRED_KEY(userId), toB64(cred.rawId));
}

/** Prompt Face ID / fingerprint. Resolves true when verified. */
export async function verifyBiometric(userId: string): Promise<boolean> {
  const stored = getStoredCredentialId(userId);
  if (!stored || !isBiometricSupported()) return false;

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: fromB64(stored), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return !!assertion;
}
