import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, Copy, Link2, Mail, Search, Wallet } from "lucide-react";
import { useDeposit } from "../../components/DepositModal";
import { AssetIcon } from "../../components/AssetIcon";
import { GiftCard, WrappedCard } from "../../components/GiftCard";
import { ASSETS, CATEGORY_FILTERS, formatUnits, getAsset, type Asset } from "../../data/assets";
import { CARD_THEMES } from "../../data/themes";
import { useAuth } from "../../auth/AuthProvider";
import { MAX_FROM, MAX_MESSAGE, buildGiftLink } from "../../lib/giftLink";
import { saveLink } from "../../lib/savedLinks";
import { PURSE_XLM, XLM_BUFFER, feeFor, isGiftTooSmall, minGiftTokens, type CreatedGift } from "../../chain/gift";
import { useCreateGift } from "../../chain/useCreateGift";
import { fmtAmount, fmtUsd, useBalances } from "../../chain/Balances";

export interface GiftDraft {
  assetId?: string;
  amount: number;
  themeId: string;
  from: string;
  message: string;
  delivery: "link" | "email";
  recipientEmail: string;
  /** How long the gift can be claimed before the sender can take it back */
  expiryDays: number;
  /** Put XLM in a purse so a recipient with no Stellar wallet yet can claim (goes to them) */
  coverSetup: boolean;
}

/** The contract allows up to 365 days; "1 year" uses 364 to stay safely inside that. */
export const EXPIRY_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 364, label: "1 year" },
];

const expiryDate = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full rounded-2xl bg-brand-600 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

const fmtPrice = (p: number) =>
  p >= 1 ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${p.toPrecision(3)}`;

/* ---------------- 1. Select token ---------------- */

export function SelectToken({ onSelect }: { onSelect: (a: Asset) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ASSETS.filter((a) => {
      if (filter === "popular" && !a.popular) return false;
      if (filter !== "all" && filter !== "popular" && a.category !== filter) return false;
      return !q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q);
    });
  }, [query, filter]);

  return (
    <div>
      <label className="relative block">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset" className={`${inputCls} pr-11`} />
        <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
      </label>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.id ? "bg-ink text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:ring-neutral-300"
            }`}
          >
            <f.icon className="h-3.5 w-3.5" />
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[420px] divide-y divide-neutral-100 overflow-y-auto rounded-2xl border border-neutral-200/80 bg-white">
        {list.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50/60"
          >
            <AssetIcon asset={a} />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{a.name}</span>
              <span className="block text-xs text-neutral-500">{a.symbol}</span>
            </span>
            <span className="text-sm font-medium text-neutral-700">{fmtPrice(a.price)}</span>
            <ChevronRight className="h-4 w-4 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </button>
        ))}
        {list.length === 0 && <p className="py-10 text-center text-sm text-neutral-500">No tokens match "{query}".</p>}
      </div>
    </div>
  );
}

/* ---------------- 2. Select amount ---------------- */

const PRESETS = [5, 25, 50, 100];

export function SelectAmount({ asset, amount, onChange, onContinue }: { asset: Asset; amount: number; onChange: (n: number) => void; onContinue: () => void }) {
  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-8">
      <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm font-medium">
        <AssetIcon asset={asset} size="sm" /> {asset.name}
      </div>
      <div className="flex items-center justify-center text-6xl font-semibold tracking-tight">
        <span>$</span>
        <input
          autoFocus
          inputMode="decimal"
          value={amount || ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
          placeholder="0"
          className="ml-2 bg-transparent outline-none"
          style={{ width: `${Math.max(1, String(amount || "0").length)}ch` }}
        />
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500">
        ≈ {formatUnits(amount || 0, asset)} {asset.symbol} <ArrowUpDown className="h-3.5 w-3.5" />
      </p>

      <div className="mt-8 flex justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-10 rounded-full px-5 text-sm font-semibold transition ${
              amount === p ? "bg-ink text-white" : "bg-surface text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            ${p}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <PrimaryButton disabled={!amount || isGiftTooSmall(asset.id, amount / asset.price)} onClick={onContinue}>
          Continue
        </PrimaryButton>
        <p className="mt-3 text-center text-xs text-neutral-500">
          Minimum gift is {fmtAmount(minGiftTokens(asset.id))} {asset.symbol} (about ${(Math.ceil(minGiftTokens(asset.id) * asset.price * 10) / 10).toFixed(2)}), so the fees stay small compared with the gift.
        </p>
      </div>
    </div>
  );
}

/* ---------------- 3. Customize ---------------- */

export function Customize({
  asset,
  draft,
  update,
  onContinue,
}: {
  asset: Asset;
  draft: GiftDraft;
  update: (p: Partial<GiftDraft>) => void;
  onContinue: () => void;
}) {
  const idx = CARD_THEMES.findIndex((t) => t.id === draft.themeId);
  const cycle = (d: number) => update({ themeId: CARD_THEMES[(idx + d + CARD_THEMES.length) % CARD_THEMES.length].id });

  return (
    <div>
      <div className="flex items-center gap-3">
        <button onClick={() => cycle(-1)} className="rounded-full p-1 hover:bg-neutral-100" aria-label="Previous design">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <GiftCard key={draft.themeId} asset={asset} theme={CARD_THEMES[idx]} className="animate-pop" />
        <button onClick={() => cycle(1)} className="rounded-full p-1 hover:bg-neutral-100" aria-label="Next design">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="no-scrollbar mt-4 flex justify-center gap-2.5 overflow-x-auto py-1">
        {CARD_THEMES.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => update({ themeId: t.id })}
            className={`h-14 w-14 shrink-0 overflow-hidden rounded-full ${t.id === draft.themeId ? "" : "opacity-50"}`}
          >
            {t.bg === "asset" ? (
              <span className={`grid h-full w-full place-items-center bg-gradient-to-br text-sm font-bold text-white ${asset.gradient}`}>{asset.glyph}</span>
            ) : (
              <span className={`grid h-full w-full place-items-center px-1 text-[8px] font-bold leading-tight text-white ${t.bg}`}>{t.tagline}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-neutral-600">From (Optional)</span>
          <input value={draft.from} maxLength={MAX_FROM} onChange={(e) => update({ from: e.target.value })} placeholder="Your name" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-neutral-600">Personal Message (Optional)</span>
          <textarea
            rows={2}
            maxLength={MAX_MESSAGE}
            value={draft.message}
            onChange={(e) => update({ message: e.target.value })}
            placeholder="Write a personal message"
            className={`${inputCls} resize-none`}
          />
          <span className="mt-1 block text-right text-xs text-neutral-400">
            {draft.message.length}/{MAX_MESSAGE}
          </span>
        </label>

        <div>
          <span className="mb-1.5 block text-sm text-neutral-600">Gift expires after</span>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_OPTIONS.map((o) => (
              <button
                key={o.days}
                type="button"
                onClick={() => update({ expiryDays: o.days })}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${
                  draft.expiryDays === o.days ? "bg-ink text-white" : "bg-surface text-neutral-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            Up to {expiryDate(draft.expiryDays)}. If it isn't claimed by then, you can take it back. A longer time costs a little more in network fees.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------- 4. Preview + delivery ---------------- */

export function Preview({
  asset,
  draft,
  update,
  onContinue,
}: {
  asset: Asset;
  draft: GiftDraft;
  update: (p: Partial<GiftDraft>) => void;
  onContinue: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const { email } = useAuth();
  const theme = CARD_THEMES.find((t) => t.id === draft.themeId)!;
  const emailValid = /^\S+@\S+\.\S+$/.test(draft.recipientEmail);

  return (
    <div>
      <div className="relative">
        {revealed ? (
          <GiftCard asset={asset} theme={theme} amount={draft.amount} showValue className="animate-pop" />
        ) : (
          <>
            <WrappedCard />
            <button
              onClick={() => setRevealed(true)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.4)]"
            >
              Preview Gift
            </button>
          </>
        )}
      </div>

      {revealed && (
        <div className="mt-5 text-center text-sm">
          <p>
            <span className="text-neutral-500">Gift from:</span> {draft.from || email || "you"}
          </p>
          {draft.message && <p className="mt-1 italic text-neutral-600">“{draft.message}”</p>}
        </div>
      )}

      <p className="mb-2 mt-6 text-sm text-neutral-500">Delivery Method</p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { id: "link", icon: Link2, title: "Sharable Link", sub: "Send via link", soon: false },
            { id: "email", icon: Mail, title: "Email", sub: "Coming soon", soon: true },
          ] as const
        ).map(({ id, icon: Icon, title, sub, soon }) => (
          <button
            key={id}
            disabled={soon}
            onClick={() => update({ delivery: id })}
            className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              draft.delivery === id ? "border-brand-600 ring-4 ring-brand-100" : "border-neutral-200"
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                draft.delivery === id ? "bg-brand-600 text-white" : "bg-surface text-neutral-600"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-neutral-600">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      {draft.delivery === "email" && (
        <input
          type="email"
          value={draft.recipientEmail}
          onChange={(e) => update({ recipientEmail: e.target.value })}
          placeholder="Recipient's email address"
          className={`${inputCls} mt-3`}
        />
      )}

      <div className="mt-5">
        <PrimaryButton disabled={draft.delivery === "email" && !emailValid} onClick={onContinue}>
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------- 5. Checkout ---------------- */

export function Checkout({
  asset,
  draft,
  update,
  onPurchased,
}: {
  asset: Asset;
  draft: GiftDraft;
  update: (p: Partial<GiftDraft>) => void;
  onPurchased: (gift: CreatedGift) => void;
}) {
  const { openDeposit } = useDeposit();
  const { amounts } = useBalances();
  const { create, busy, error } = useCreateGift();
  const theme = CARD_THEMES.find((t) => t.id === draft.themeId)!;
  // The gift is paid from the user's own wallet, in the token they chose.
  // Amounts here are in tokens; the dollar value uses placeholder prices for now.
  const giftTokens = Math.round((draft.amount / asset.price) * 1e7) / 1e7;
  const feeUsd = draft.amount * 0.015;
  // The setup fee is optional. When chosen it is always 1 XLM, paid from the wallet's XLM whatever the gift is in.
  const setupXlm = draft.coverSetup ? PURSE_XLM : 0;
  const setupUsd = setupXlm * (getAsset("xlm")?.price ?? 0);
  const total = draft.amount + feeUsd + setupUsd;
  const heldTokens = amounts[asset.id] ?? 0;
  const heldXlm = amounts.xlm ?? 0;
  const available = heldTokens * asset.price;
  // For an XLM gift the gift, 1.5% and setup fee all come out of XLM; keep a little back for network fees.
  const needTokens = giftTokens + feeFor(giftTokens) + (asset.id === "xlm" ? setupXlm + XLM_BUFFER : 0);
  const insufficient = heldTokens < needTokens;
  const tooSmall = isGiftTooSmall(asset.id, giftTokens);
  // A USDC or EURC gift still needs some XLM in the wallet for network fees (and the setup fee, if chosen).
  const needsXlm = asset.id !== "xlm" && heldXlm < setupXlm + XLM_BUFFER;

  const purchase = async () => {
    const gift = await create({ tokenId: asset.id, amount: giftTokens, expiryDays: draft.expiryDays, withPurse: draft.coverSetup });
    if (gift) onPurchased(gift);
  };

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-[260px_1fr]">
        <GiftCard asset={asset} theme={theme} amount={draft.amount} showValue />
        <div>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold">{asset.name} Gift Card</h2>
            <span className="text-xl font-bold">${draft.amount.toFixed(2)}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            ≈ {formatUnits(draft.amount, asset)} {asset.symbol}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Delivery: {draft.delivery === "email" ? draft.recipientEmail : "Sharable link"}
          </p>
        </div>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <input
          type="checkbox"
          checked={draft.coverSetup}
          onChange={(e) => update({ coverSetup: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#E4560C]"
        />
        <span>
          <span className="block text-sm font-semibold">Set up a wallet for the recipient ({PURSE_XLM} XLM)</span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            Tick this if the person you're sending to doesn't have a Stellar wallet yet. These {PURSE_XLM} XLM go into their new wallet, so they can claim without needing any XLM of their own. Skip it if they already have one.
          </span>
        </span>
      </label>

      <dl className="mt-5 space-y-2 border-t border-neutral-200 pt-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">Gift value</dt>
          <dd>${draft.amount.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">Processing fee (1.5%)</dt>
          <dd>${feeUsd.toFixed(2)}</dd>
        </div>
        {draft.coverSetup && (
          <div className="flex justify-between">
            <dt className="text-neutral-600">Recipient's wallet setup (in XLM)</dt>
            <dd>
              {PURSE_XLM} XLM <span className="text-neutral-400">(${setupUsd.toFixed(2)})</span>
            </dd>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd>${total.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between border-t border-neutral-100 pt-2">
          <dt className="text-neutral-600">Claimable until</dt>
          <dd>{expiryDate(draft.expiryDays)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-neutral-500">
        The recipient gets the full gift amount. The 1.5% processing fee isn't returned if the gift expires.
        {draft.coverSetup &&
          ` The ${PURSE_XLM} XLM for their wallet is taken from your XLM, even when the gift is USDC or EURC, and goes to them, not to Lumecard. If the gift isn't claimed, you can take it back together with the gift.`}
      </p>

      <div className="mt-6 border-t border-neutral-200 pt-5">
        <p className="text-neutral-600">Paying with</p>
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-brand-600 bg-brand-50 px-4 py-3">
          <Wallet className="h-5 w-5 text-brand-600" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Your wallet ({asset.symbol})</span>
            <span className="block text-xs text-neutral-500">
              {fmtAmount(heldTokens)} {asset.symbol} available ({fmtUsd(available)})
            </span>
          </span>
          <Check className="h-4 w-4 text-brand-600" />
        </div>
        {insufficient && (
          <p className="mt-2 text-sm text-neutral-600">
            Not enough balance{asset.id === "xlm" ? " (a little XLM is kept back for network fees)" : ""}.{" "}
            <button onClick={openDeposit} className="font-semibold text-brand-600 hover:underline">
              Deposit funds
            </button>
          </p>
        )}
        {!insufficient && needsXlm && (
          <p className="mt-2 text-sm text-neutral-600">
            You also need at least {setupXlm + XLM_BUFFER} XLM in your wallet
            {draft.coverSetup ? `: ${PURSE_XLM} for the recipient's wallet, and a little for network fees` : " for network fees"}.
          </p>
        )}
      </div>

      <div className="mt-6">
        {tooSmall && <p className="mb-3 text-center text-sm text-red-600">This gift is too small to cover its fees. Go back and choose a larger amount.</p>}
        <PrimaryButton disabled={busy || insufficient || needsXlm || tooSmall} onClick={purchase}>
          {busy ? "Confirming on Stellar…" : "Purchase Gift"}
        </PrimaryButton>
        {error && <p className="mt-3 break-words text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

/* ---------------- 6. Done ---------------- */

export function Done({
  asset,
  draft,
  gift,
  onFinish,
  onAnother,
}: {
  asset: Asset;
  draft: GiftDraft;
  gift: CreatedGift;
  onFinish: () => void;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // The link opens this site's claim page. The gift's secret key, and the name, message
  // and card design, travel inside it after the #, so they never reach a server.
  const [link] = useState(() =>
    buildGiftLink(window.location.origin, gift.giftKeyHex.slice(0, 10), gift.secret, {
      assetId: asset.id,
      amount: draft.amount,
      themeId: draft.themeId,
      from: draft.from,
      message: draft.message,
      expiresAt: gift.expiresAt,
    }),
  );
  const theme = CARD_THEMES.find((t) => t.id === draft.themeId)!;
  const { stellarAddress } = useAuth();

  // Remember the link in this browser so it can be copied again from the dashboard.
  useEffect(() => {
    if (stellarAddress) saveLink(stellarAddress, gift.giftKeyHex, link);
  }, [stellarAddress, gift.giftKeyHex, link]);

  return (
    <div className="text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-600">
        <Check className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold">Your gift is ready!</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Your ${draft.amount} of {asset.symbol} is locked in the gift contract. Share the link below with the person you're sending it to.
      </p>
      <a
        href={`https://stellar.expert/explorer/testnet/tx/${gift.txHash}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs text-neutral-500 underline"
      >
        View the transaction
      </a>

      <div className="mx-auto mt-6 max-w-sm">
        <GiftCard asset={asset} theme={theme} amount={draft.amount} showValue />
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl bg-surface p-2 pl-4">
        <span className="flex-1 truncate text-left text-sm">{link}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {});
          }}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {gift.purse && (
        <p className="mt-3 text-xs text-neutral-500">
          This gift includes {PURSE_XLM} XLM to set up a new wallet for the recipient, so they can claim even if they have no XLM.
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        Anyone with this link can claim the gift, so only share it with the person it's for. If it isn't claimed by{" "}
        {new Date(gift.expiresAt * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}, you can take it back.
      </p>

      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={onFinish}>Back to dashboard</PrimaryButton>
        <button onClick={onAnother} className="text-sm font-semibold text-brand-600 hover:underline">
          Send another gift
        </button>
      </div>
    </div>
  );
}
