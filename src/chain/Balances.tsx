import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { ASSETS, getAsset } from "../data/assets";

/**
 * Real wallet balances, read from Stellar testnet (Horizon).
 * Prices used for the dollar totals are still the placeholders in data/assets.ts.
 */
import { HORIZON_URL } from "./gift";
export { HORIZON_URL };

// Testnet issuers (from Circle's docs). Must match lumecard/deployments/testnet.json.
const ISSUERS: Record<string, string> = {
  usdc: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  eurc: "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
};

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface BalanceState {
  /** Token amount held, by asset id (xlm, usdc, eurc) */
  amounts: Record<string, number>;
  /** Estimated total in USD */
  totalUsd: number;
  /** How many different tokens are held (non-zero) */
  tokenCount: number;
  /** First load in progress */
  loading: boolean;
  /** false when the account doesn't exist on the network yet (never funded) */
  funded: boolean;
  /** Set if the network couldn't be reached */
  error?: string;
  refresh: () => void;
}

const empty: BalanceState = { amounts: {}, totalUsd: 0, tokenCount: 0, loading: false, funded: true, refresh: () => {} };
const BalanceContext = createContext<BalanceState>(empty);
export const useBalances = () => useContext(BalanceContext);

function parse(balances: HorizonBalance[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of balances) {
    if (b.asset_type === "native") out.xlm = Number(b.balance);
    else if (b.asset_code) {
      const id = b.asset_code.toLowerCase();
      if (ISSUERS[id] && ISSUERS[id] === b.asset_issuer) out[id] = Number(b.balance);
    }
  }
  return out;
}

export function BalanceProvider({ children }: { children: ReactNode }) {
  const { stellarAddress } = useAuth();
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [funded, setFunded] = useState(true);
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!stellarAddress) {
      setAmounts({});
      return;
    }
    let cancelled = false;
    const load = async (first: boolean) => {
      if (first) setLoading(true);
      try {
        const res = await fetch(`${HORIZON_URL}/accounts/${stellarAddress}`);
        if (cancelled) return;
        if (res.status === 404) {
          setFunded(false); // account doesn't exist until someone sends it XLM
          setAmounts({});
        } else if (res.ok) {
          const json = (await res.json()) as { balances: HorizonBalance[] };
          setFunded(true);
          setAmounts(parse(json.balances));
        } else {
          throw new Error(`Network error ${res.status}`);
        }
        setError(undefined);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load balances");
      } finally {
        if (!cancelled && first) setLoading(false);
      }
    };
    load(true);
    const id = setInterval(() => load(false), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stellarAddress, tick]);

  const value = useMemo<BalanceState>(() => {
    let totalUsd = 0;
    let tokenCount = 0;
    for (const a of ASSETS) {
      const amt = amounts[a.id] ?? 0;
      if (amt > 0) {
        tokenCount += 1;
        totalUsd += amt * (getAsset(a.id)?.price ?? 0);
      }
    }
    return { amounts, totalUsd, tokenCount, loading, funded, error, refresh };
  }, [amounts, loading, funded, error, refresh]);

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export const fmtUsd = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtAmount = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: n >= 1 ? 2 : 6 });
