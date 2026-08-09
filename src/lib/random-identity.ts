/** Random default profile identity — friendly name, username and generated avatar. */

const ADJECTIVES = [
  "Swift", "Lunar", "Crimson", "Golden", "Silent", "Cosmic", "Bright", "Noble",
  "Rapid", "Bold", "Solar", "Azure", "Mellow", "Prime", "Vivid", "Quantum",
];

const NOUNS = [
  "Otter", "Falcon", "Comet", "Panther", "Voyager", "Nova", "Fox", "Ranger",
  "Dolphin", "Tiger", "Pilot", "Harbor", "Maple", "Onyx", "Koi", "Ember",
];

const GRADIENTS: Array<[string, string]> = [
  ["#7C5CFF", "#22D3EE"],
  ["#F472B6", "#7C3AED"],
  ["#34D399", "#0EA5E9"],
  ["#FBBF24", "#F97316"],
  ["#60A5FA", "#A78BFA"],
  ["#F87171", "#FB923C"],
  ["#2DD4BF", "#4ADE80"],
  ["#818CF8", "#EC4899"],
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function randomDisplayName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export function usernameFromDisplayName(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base.slice(0, 20)}${suffix}`;
}

/** Deterministic-ish gradient avatar with initials, as an inline SVG data URL. */
export function generateAvatarDataUrl(name: string): string {
  const [from, to] = pick(GRADIENTS);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "OP";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="62" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function randomIdentity() {
  const displayName = randomDisplayName();
  return {
    displayName,
    username: usernameFromDisplayName(displayName),
    avatarUrl: generateAvatarDataUrl(displayName),
  };
}
