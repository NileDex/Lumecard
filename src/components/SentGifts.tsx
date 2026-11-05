import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { fetchSentGifts, type GiftStatus, type SentGift } from "../chain/sentGifts";
import { fmtAmount, useBalances } from "../chain/Balances";
import { friendlyError, takeBackGiftOnChain } from "../chain/gift";
import { usePrivySigner } from "../chain/privySigner";
import { AssetIcon } from "./AssetIcon";
import { getAsset } from "../data/assets";
import { getSavedLink } from "../lib/savedLinks";

const STATUS: Record<GiftStatus, { label: string; hint: string; cls: string }> = {
  waiting: { label: "Waiting", hint: "Not claimed yet", cls: "bg-brand-50 text-brand-700" },
  expired: { label: "Expired", hint: "You can take it back", cls: "bg-neutral-100 text-neutral-600" },
  done: { label: "Completed", hint: "Claimed or returned", cls: "bg-neutral-100 text-neutral-600" },
};

function Row({ gift, wallet, onChanged }: { gift: SentGift; wallet: string; onChanged: () => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const signer = usePrivySigner();
  const { refresh } = useBalances();
  const asset = getAsset(gift.tokenId);
  if (!asset) return null;
  const s = STATUS[gift.status];
  const link = gift.status === "waiting" ? getSavedLink(wallet, gift.giftKeyHex) : undefined;
  const date = new Date(gift.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Returns the gift to the sender, and the recipient's wallet XLM too if the sender had set some aside.
  const takeBack = async () => {
    if (!signer) return;
    setBusy(true);
    setError(undefined);
    try {
      await takeBackGiftOnChain({ sender: wallet, giftKeyHex: gift.giftKeyHex, sign: signer });
      refresh();
      onChanged();
    } catch (e) {
      console.error("Take back failed", e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <AssetIcon asset={asset} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {fmtAmount(gift.amount)} {asset.symbol}
          </span>
          <span className="block truncate text-xs text-neutral-500">
            {s.hint} · Sent {date}
          </span>
        </span>
        {link && (
          <button
            onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {})}
            aria-label="Copy gift link"
            className="grid h-8 w-8 place-items-center rounded-full border border-neutral-200 text-neutral-600"
          >
            {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
        {gift.status === "expired" ? (
          <button
            onClick={takeBack}
            disabled={busy || !signer}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.4)] disabled:opacity-60"
          >
            {busy ? "Taking back…" : "Take back"}
          </button>
        ) : (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
        )}
      </div>
      {error && <p className="mt-2 break-words text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** The wallet's sent gifts, read from the network. `empty` shows when there are none. */
export function SentGifts({ empty }: { empty: ReactNode }) {
  const { stellarAddress } = useAuth();
  const [gifts, setGifts] = useState<SentGift[]>();
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!stellarAddress) return;
    let cancelled = false;
    const load = () =>
      fetchSentGifts(stellarAddress)
        .then((g) => {
          if (!cancelled) {
            setGifts(g);
            setError(undefined);
          }
        })
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load gifts"));
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stellarAddress, reloadKey]);

  if (!gifts) {
    return error ? (
      <p className="rounded-2xl border border-neutral-200/80 bg-white p-5 text-sm text-neutral-500">Couldn't load your gifts. Retrying…</p>
    ) : (
      <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
    );
  }
  if (gifts.length === 0) return <>{empty}</>;

  return (
    <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
      {gifts.map((g) => (
        <Row key={g.giftKeyHex} gift={g} wallet={stellarAddress!} onChanged={() => setReloadKey((k) => k + 1)} />
      ))}
    </div>
  );
}
