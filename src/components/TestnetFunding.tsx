import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useBalances } from "../chain/Balances";
import { useEnableTokens } from "../chain/useEnableTokens";

/**
 * Testnet helper on the dashboard: opt the wallet in to USDC and EURC, then
 * point the user to Circle's test-token faucet. Testnet only.
 */
export function TestnetFunding() {
  const { stellarAddress } = useAuth();
  const { funded, loading } = useBalances();
  const { missing, enable, busy, error, canEnable } = useEnableTokens();
  const [copied, setCopied] = useState(false);

  if (!stellarAddress || loading) return null;

  const btn =
    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold";

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200/80 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Testnet</p>
      <h2 className="mt-1 font-semibold">Get test USDC and EURC</h2>

      {!funded ? (
        <p className="mt-2 text-sm text-neutral-600">
          This wallet isn't active yet. Send it some test XLM first (Stellar's Friendbot does this for free), then come back.
        </p>
      ) : missing.length > 0 ? (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Step 1. Your wallet has to opt in to {missing.join(" and ")} before it can hold them. This is a small
            one-time transaction signed by your wallet.
          </p>
          <button
            onClick={() => enable()}
            disabled={busy || !canEnable}
            className={`${btn} mt-4 bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)] disabled:opacity-60`}
          >
            {busy ? "Waiting for the network…" : `Enable ${missing.join(" and ")}`}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Step 2. Your wallet can hold USDC and EURC. Copy your address and request test tokens on Circle's faucet
            (choose <b>Stellar Testnet</b>, one token at a time).
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(stellarAddress).catch(() => {});
                setCopied(true);
              }}
              className={`${btn} border border-neutral-200`}
            >
              {copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />} Copy my address
            </button>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className={`${btn} bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)]`}
            >
              Open Circle faucet <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Balances refresh on their own every few seconds.</p>
        </>
      )}
    </section>
  );
}
