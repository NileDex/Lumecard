import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Copy, ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { GiftCard, WrappedCard } from "../components/GiftCard";
import { getAsset, type Asset } from "../data/assets";
import { CARD_THEMES } from "../data/themes";
import { useConnectWallet } from "../components/ConnectWallet";
import { useAuth } from "../auth/AuthProvider";
import { useBalances } from "../chain/Balances";
import { useEnableTokens } from "../chain/useEnableTokens";
import { useClaimGift } from "../chain/useClaimGift";
import { activateWalletFromPurse, friendlyError, getPurseBalance, giftKeyHexFromSecret, isGiftHeld } from "../chain/gift";
import { parseGiftFragment, parseGiftSecret, type GiftDetails } from "../lib/giftLink";

/**
 * Recipient page a gift link opens: /g/:id#<secret>.<details>
 * Everything after "#" stays in the browser and never reaches a server.
 * The recipient's own wallet submits the claim and pays the small network fee, so it must exist
 * on the network and hold a little XLM. If the sender put XLM in the gift's "purse", a brand-new
 * wallet is created from it first, using only the gift key from the link. No server is involved.
 */
const button =
  "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-6)}` : "");

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 text-sm text-neutral-600">{children}</div>;
}

/** The sign-in / get-ready / claim steps. Only mounted when Privy is configured. */
function ClaimPanel({
  gift,
  asset,
  secret,
  giftKeyHex,
  onClaimed,
}: {
  gift: GiftDetails;
  asset: Asset;
  secret: string;
  giftKeyHex: string;
  onClaimed: (tx: string) => void;
}) {
  const { authenticated, stellarAddress, creatingWallet } = useAuth();
  const { openConnect } = useConnectWallet();
  const { loading, funded, amounts, refresh } = useBalances();
  const enable = useEnableTokens();
  const { claim, busy, error } = useClaimGift();
  const [copied, setCopied] = useState(false);

  // If the wallet doesn't exist yet, look for the gift's purse: XLM the sender put aside to set it up.
  const [purse, setPurse] = useState<number | null | undefined>(undefined);
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string>();
  useEffect(() => {
    if (!authenticated || !stellarAddress || loading || funded) return;
    let cancelled = false;
    getPurseBalance(giftKeyHex)
      .then((v) => !cancelled && setPurse(v))
      .catch(() => !cancelled && setPurse(null));
    return () => {
      cancelled = true;
    };
  }, [authenticated, stellarAddress, loading, funded, giftKeyHex]);

  const setUpWallet = async () => {
    if (!stellarAddress) return;
    setSettingUp(true);
    setSetupError(undefined);
    try {
      // Signed with the gift's own key from the link: the new person needs no XLM and no server.
      await activateWalletFromPurse({ giftSecret: secret, recipient: stellarAddress });
      refresh();
    } catch (e) {
      console.error("Wallet setup failed", e);
      setSetupError(friendlyError(e));
    } finally {
      setSettingUp(false);
    }
  };

  if (!authenticated) {
    return (
      <>
        <button onClick={() => openConnect()} className={button}>
          Sign in to claim
        </button>
        <p className="mt-3 text-center text-xs text-neutral-500">
          New here? Signing in with your email creates a wallet for you.
        </p>
      </>
    );
  }
  if (creatingWallet || !stellarAddress || loading) return <Notice>Getting your wallet ready…</Notice>;

  if (!funded && purse === undefined) return <Notice>Checking your gift…</Notice>;

  // The sender set aside XLM to create this person's wallet.
  if (!funded && purse !== null && purse !== undefined && purse >= 1.5) {
    return (
      <>
        <Notice>
          <p className="font-semibold text-ink">One quick step first</p>
          <p className="mt-1">
            The sender included a little XLM to set up your new wallet. It goes straight to you, and you don't need any of your own.
          </p>
        </Notice>
        <button onClick={setUpWallet} disabled={settingUp} className={`${button} mt-3`}>
          {settingUp ? "Setting up your wallet…" : "Set up my wallet"}
        </button>
        {setupError && <p className="mt-3 break-words text-center text-sm text-red-600">{setupError}</p>}
      </>
    );
  }

  if (!funded) {
    return (
      <Notice>
        <p className="font-semibold text-ink">Your wallet isn't active yet</p>
        <p className="mt-1">
          A new wallet needs a little XLM to exist on the network and pay the small claim fee. Send some to this address, then come back.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(stellarAddress).then(() => setCopied(true)).catch(() => {});
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3 font-mono text-xs"
          >
            {short(stellarAddress)} {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`https://friendbot.stellar.org/?addr=${stellarAddress}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-semibold"
          >
            Get free test XLM <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </Notice>
    );
  }

  // Tokens other than XLM need the wallet to opt in before it can hold them.
  const needsOptIn = asset.id !== "xlm" && amounts[asset.id] === undefined;
  if (needsOptIn) {
    return (
      <>
        <Notice>
          <p className="font-semibold text-ink">One quick step first</p>
          <p className="mt-1">Your wallet has to opt in to {asset.symbol} before it can hold it. You only do this once.</p>
        </Notice>
        {/* Only this gift's token: each opt-in locks 0.5 XLM, and a new wallet has little to spare. */}
        <button onClick={() => enable.enable([asset.symbol])} disabled={enable.busy} className={`${button} mt-3`}>
          {enable.busy ? "Waiting for the network…" : `Enable ${asset.symbol}`}
        </button>
        {enable.error && <p className="mt-3 break-words text-center text-sm text-red-600">{enable.error}</p>}
      </>
    );
  }

  // Stellar locks 1 XLM plus 0.5 XLM per token opt-in. The claim needs a little spare XLM on top, for its fee.
  const optIns = Object.keys(amounts).filter((k) => k !== "xlm").length;
  const spareXlm = (amounts.xlm ?? 0) - (1 + 0.5 * optIns);
  if (spareXlm < 0.01) {
    return (
      <Notice>
        <p className="font-semibold text-ink">Your wallet needs a little more XLM</p>
        <p className="mt-1">
          Part of your XLM is locked as Stellar's minimum balance, and there isn't enough spare to pay the network fee for the claim. Send a little XLM (about 1) to this address, then come back.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(stellarAddress).then(() => setCopied(true)).catch(() => {});
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3 font-mono text-xs"
          >
            {short(stellarAddress)} {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </Notice>
    );
  }

  return (
    <>
      <button
        onClick={async () => {
          const tx = await claim(secret);
          if (tx) onClaimed(tx);
        }}
        disabled={busy}
        className={button}
      >
        {busy ? "Confirming on Stellar…" : `Claim $${gift.amount} of ${asset.symbol}`}
      </button>
      {error && <p className="mt-3 break-words text-center text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-center text-xs text-neutral-500">It goes straight into your wallet {short(stellarAddress)}.</p>
    </>
  );
}

export default function ClaimGift() {
  const { hash } = useLocation();
  const { configured } = useAuth();
  const [stage, setStage] = useState<"wrapped" | "opened">("wrapped");
  const [claimedTx, setClaimedTx] = useState<string>();
  const [held, setHeld] = useState<boolean>();

  const gift = useMemo(() => parseGiftFragment(hash), [hash]);
  const secret = useMemo(() => parseGiftSecret(hash), [hash]);
  const giftKeyHex = useMemo(() => {
    try {
      return secret ? giftKeyHexFromSecret(secret) : null;
    } catch {
      return null;
    }
  }, [secret]);

  // Is the gift still waiting? (public, read-only)
  useEffect(() => {
    if (!giftKeyHex) return;
    let cancelled = false;
    isGiftHeld(giftKeyHex)
      .then((h) => !cancelled && setHeld(h))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [giftKeyHex]);

  const asset = gift ? getAsset(gift.assetId) : undefined;
  const theme = gift ? CARD_THEMES.find((t) => t.id === gift.themeId) : undefined;

  if (!gift || !asset || !theme || !secret || !giftKeyHex) {
    return (
      <div className="min-h-screen bg-[#fafafb]">
        <Header />
        <main className="mx-auto max-w-[520px] px-4 pt-16 text-center sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">This gift link isn't complete</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Ask the sender to share the full link again. It should look like one long address, and every part matters.
          </p>
        </main>
      </div>
    );
  }

  const sender = gift.from || "Someone";
  const expiry = gift.expiresAt
    ? new Date(gift.expiresAt * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <Header />
      <main className="mx-auto max-w-[520px] px-4 pb-16 pt-10 sm:px-6">
        {claimedTx ? (
          <div className="animate-pop text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-600">
              <Check className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold">Gift claimed!</h1>
            <p className="mt-1 text-sm text-neutral-600">
              ${gift.amount} of {asset.symbol} is now in your wallet.
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${claimedTx}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-neutral-500 underline"
            >
              View the transaction
            </a>
            <div className="mx-auto mt-6 max-w-sm">
              <GiftCard asset={asset} theme={theme} amount={gift.amount} showValue />
            </div>
            <div className="mt-8 space-y-3">
              <Link to="/app" className={button}>
                View my wallet
              </Link>
              <Link to="/app/gifts/create" className="block text-sm font-semibold text-brand-600">
                Send a gift back
              </Link>
            </div>
          </div>
        ) : stage === "wrapped" ? (
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-neutral-400">You've received a gift</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{sender} sent you something</h1>
            <div className="relative mt-8">
              <WrappedCard />
            </div>
            <button onClick={() => setStage("opened")} className={`${button} mt-8`}>
              Open gift
            </button>
          </div>
        ) : (
          <div className="animate-pop">
            <GiftCard asset={asset} theme={theme} amount={gift.amount} showValue />
            <div className="mt-6 rounded-2xl border border-neutral-200/80 bg-white p-5">
              <p className="text-sm text-neutral-500">From {sender}</p>
              {gift.message && <p className="mt-1 break-words text-lg">“{gift.message}”</p>}
              {expiry && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
                  <Clock className="h-3.5 w-3.5" /> Claim before {expiry}
                </p>
              )}
            </div>

            <div className="mt-6">
              {held === false ? (
                <Notice>
                  <p className="font-semibold text-ink">This gift is no longer available</p>
                  <p className="mt-1">It has already been claimed, or the sender took it back.</p>
                </Notice>
              ) : configured ? (
                <ClaimPanel gift={gift} asset={asset} secret={secret} giftKeyHex={giftKeyHex} onClaimed={setClaimedTx} />
              ) : (
                <Notice>Sign-in isn't set up yet, so gifts can't be claimed here.</Notice>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
