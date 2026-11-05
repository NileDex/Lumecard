/**
 * Remembers gift links in this browser so the sender can copy them again.
 * The gift's secret key lives only in the link (never on-chain), so if it isn't
 * saved here it can't be recovered. Per browser, per wallet.
 */
const storeKey = (wallet: string) => `lumecard:links:${wallet}`;

const read = (wallet: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(storeKey(wallet)) ?? "{}");
  } catch {
    return {};
  }
};

export function saveLink(wallet: string, giftKeyHex: string, link: string) {
  try {
    localStorage.setItem(storeKey(wallet), JSON.stringify({ ...read(wallet), [giftKeyHex]: link }));
  } catch {
    // storage unavailable (private window, blocked): the link just isn't remembered
  }
}

export const getSavedLink = (wallet: string, giftKeyHex: string): string | undefined => read(wallet)[giftKeyHex];
