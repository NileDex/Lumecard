import { getAsset } from "../data/assets";
import { CARD_THEMES } from "../data/themes";

/**
 * Gift link format:   /g/<id>#<secret>.<details>
 *
 * Everything after "#" stays in the browser and is never sent to a server.
 *  - <secret>  the gift key (placeholder for now)
 *  - <details> the sender's name, message, card design, token, amount and
 *              expiry, as base64url-encoded JSON.
 * Anyone with the link can read the details, which is the same trust level as
 * being able to claim the gift.
 */
export const MAX_MESSAGE = 100;
export const MAX_FROM = 40;

export interface GiftDetails {
  assetId: string;
  amount: number;
  themeId: string;
  from: string;
  message: string;
  /** Unix seconds, shown to the recipient. The contract enforces the real expiry. */
  expiresAt: number;
}

const b64urlEncode = (s: string) => {
  let bin = "";
  new TextEncoder().encode(s).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlDecode = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function buildGiftLink(origin: string, id: string, secret: string, d: GiftDetails): string {
  const payload = b64urlEncode(
    JSON.stringify({
      a: d.assetId,
      n: d.amount,
      t: d.themeId,
      f: d.from.trim().slice(0, MAX_FROM),
      m: d.message.trim().slice(0, MAX_MESSAGE),
      e: d.expiresAt,
    }),
  );
  return `${origin}/g/${id}#${secret}.${payload}`;
}

/** The gift's secret key from a link's "#<secret>.<details>" part, or null if there isn't one. */
export function parseGiftSecret(hash: string): string | null {
  const frag = hash.replace(/^#/, "");
  const dot = frag.indexOf(".");
  const secret = dot < 0 ? "" : frag.slice(0, dot);
  return /^S[A-Z2-7]{55}$/.test(secret) ? secret : null;
}

/**
 * Reads details back out of a link's "#..." part. Links can be edited by
 * anyone, so every field is checked and clamped. Returns null if unusable.
 */
export function parseGiftFragment(hash: string): GiftDetails | null {
  try {
    const frag = hash.replace(/^#/, "");
    const dot = frag.indexOf(".");
    if (dot < 0) return null;
    const j = JSON.parse(b64urlDecode(frag.slice(dot + 1))) as Record<string, unknown>;

    const assetId = typeof j.a === "string" && getAsset(j.a) ? j.a : null;
    const amount = typeof j.n === "number" && Number.isFinite(j.n) && j.n > 0 && j.n <= 1e9 ? j.n : null;
    if (!assetId || amount === null) return null;

    const themeId = typeof j.t === "string" && CARD_THEMES.some((t) => t.id === j.t) ? j.t : "asset";
    const expiresAt = typeof j.e === "number" && Number.isFinite(j.e) ? j.e : 0;
    return {
      assetId,
      amount,
      themeId,
      from: typeof j.f === "string" ? j.f.slice(0, MAX_FROM) : "",
      message: typeof j.m === "string" ? j.m.slice(0, MAX_MESSAGE) : "",
      expiresAt,
    };
  } catch {
    return null;
  }
}
