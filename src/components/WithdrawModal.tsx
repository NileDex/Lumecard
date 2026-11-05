import { createContext, useContext, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { fmtAmount, useBalances } from "../chain/Balances";
import { usePrivySigner } from "../chain/privySigner";
import { isStellarAddress, sendPaymentOnChain } from "../chain/transfer";
import { ASSETS, getAsset } from "../data/assets";

const WithdrawContext = createContext<{ openWithdraw: () => void }>({ openWithdraw: () => {} });
export const useWithdraw = () => useContext(WithdrawContext);

export function WithdrawProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <WithdrawContext.Provider value={{ openWithdraw: () => setOpen(true) }}>
      {children}
      {open && <WithdrawModal onClose={() => setOpen(false)} />}
    </WithdrawContext.Provider>
  );
}

const input =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";
const primary =
  "h-12 w-full rounded-full bg-brand-600 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none";
const outline =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;
const floor7 = (n: number) => Math.floor(n * 1e7) / 1e7;

/** Most the user can send. XLM keeps back the wallet's minimum balance plus a little for fees. */
function maxFor(tokenId: string, amounts: Record<string, number>): number {
  const held = amounts[tokenId] ?? 0;
  if (tokenId !== "xlm") return floor7(held);
  const trustlines = Object.keys(amounts).filter((k) => k !== "xlm").length;
  return floor7(Math.max(0, held - (1.5 + 0.5 * trustlines)));
}

function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { stellarAddress } = useAuth();
  const { amounts, refresh } = useBalances();
  const signer = usePrivySigner();

  const [tokenId, setTokenId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [mode, setMode] = useState<"form" | "wallet" | "done">("form");
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<string>();

  const asset = getAsset(tokenId);
  const max = asset ? maxFor(asset.id, amounts) : 0;
  const amount = Number(amountText);
  const validAmount = !!asset && amount > 0 && amount <= max;

  const send = async () => {
    if (!asset || !stellarAddress || !signer) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await sendPaymentOnChain({ source: stellarAddress, destination: dest, tokenId: asset.id, amount, sign: signer });
      setTxHash(res.txHash);
      setMode("done");
      refresh();
    } catch (e) {
      console.error("Withdraw failed", e);
      setError(e instanceof Error ? e.message : "The transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-pop relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-500">
          <X className="h-5 w-5" />
        </button>

        {mode === "form" && (
          <>
            <h2 className="pr-8 text-center text-xl font-semibold">Withdraw Funds</h2>

            <div className="relative mt-6">
              <select
                value={tokenId}
                onChange={(e) => {
                  setTokenId(e.target.value);
                  setAmountText("");
                }}
                className={`${input} appearance-none rounded-full pr-10 ${tokenId ? "text-ink" : "text-neutral-400"}`}
              >
                <option value="" disabled>
                  Select Token
                </option>
                {ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.symbol} ({fmtAmount(amounts[a.id] ?? 0)} available)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            </div>

            <p className="mb-1.5 mt-5 text-sm text-neutral-500">Amount ({asset?.symbol ?? "token"})</p>
            <div className="flex items-center gap-2 rounded-xl bg-surface px-4 py-2">
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                disabled={!asset}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
              />
              <button
                disabled={!asset || max <= 0}
                onClick={() => setAmountText(String(max))}
                className="rounded-md border border-neutral-400 px-2 py-0.5 text-xs font-medium disabled:opacity-40"
              >
                Max
              </button>
            </div>
            {asset && (
              <p className="mt-1.5 text-xs text-neutral-500">
                {amount > max ? "That's more than you can send. " : ""}
                You can send up to {fmtAmount(max)} {asset.symbol}.
                {asset.id === "xlm" && " A little XLM stays in your wallet for fees."}
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button disabled={!validAmount} onClick={() => setMode("wallet")} className={primary}>
                Transfer to another wallet
              </button>
              <button disabled className={outline}>
                Withdraw to Coinbase <span className="text-xs font-normal text-neutral-500">Coming soon</span>
              </button>
              <button disabled className={outline}>
                Transfer to Bank Account <span className="text-xs font-normal text-neutral-500">Coming soon</span>
              </button>
            </div>
          </>
        )}

        {mode === "wallet" && asset && (
          <>
            <button onClick={() => { setMode("form"); setError(undefined); }} className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h2 className="text-xl font-semibold">Send to a Stellar wallet</h2>
            <p className="mt-1 text-sm text-neutral-500">
              You're sending {fmtAmount(amount)} {asset.symbol}. Paste the address it should go to.
            </p>
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="G..."
              spellCheck={false}
              className={`${input} mt-4 font-mono`}
            />
            {dest.trim() && !isStellarAddress(dest) && (
              <p className="mt-2 text-xs text-red-600">That doesn't look like a Stellar address (it starts with G and is 56 characters long).</p>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              Check the address carefully. Transfers can't be undone, and the other wallet must have enabled {asset.id === "xlm" ? "XLM" : asset.symbol}.
            </p>
            <button disabled={busy || !isStellarAddress(dest) || !signer} onClick={send} className={`${primary} mt-5`}>
              {busy ? "Confirming on Stellar…" : `Send ${fmtAmount(amount)} ${asset.symbol}`}
            </button>
            {error && <p className="mt-3 break-words text-center text-sm text-red-600">{error}</p>}
          </>
        )}

        {mode === "done" && asset && (
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-600">
              <Check className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Sent!</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {fmtAmount(amount)} {asset.symbol} is on its way to <span className="font-mono">{short(dest.trim())}</span>.
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-neutral-500 underline"
            >
              View the transaction
            </a>
            <button onClick={onClose} className={`${primary} mt-6`}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
