import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeft, ExternalLink, Gift, TrendingUp } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { fmtAmount, fmtUsd, useBalances } from "../chain/Balances";
import { AssetIcon } from "../components/AssetIcon";
import { useDeposit } from "../components/DepositModal";
import { DESCRIPTIONS, fmtPrice, getAsset } from "../data/assets";

const RANGES = ["1D", "1W", "1M", "1Y", "All"] as const;

/** Mock price series for display only — deterministic per token + range */
function mockSeries(seed: string, points = 60) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let v = 50;
  return Array.from({ length: points }, () => (v = Math.max(5, Math.min(95, v + (rand() - 0.47) * 8))));
}

function Chart({ seed }: { seed: string }) {
  const data = useMemo(() => mockSeries(seed), [seed]);
  const w = 600;
  const h = 200;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 16) - 8]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-52 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#fill)" />
      <path d={line} fill="none" stroke="var(--color-brand-600)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function TokenPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { openDeposit } = useDeposit();
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");
  const balances = useBalances();
  const asset = getAsset(id);
  if (!asset) return <Navigate to="/app" replace />;

  const held = balances.amounts[asset.id] ?? 0;

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <Header signedIn />
      <main className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <section className="mt-4 rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-5">
              <AssetIcon asset={asset} size="lg" className="!rounded-full" />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {asset.name} <span className="text-lg font-normal text-neutral-400">{asset.symbol}</span>
                </h1>
                <p className="mt-1 flex items-center gap-2 text-neutral-600">
                  {fmtPrice(asset.price)}
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-neutral-600">
                    <TrendingUp className="h-3 w-3" /> 24h
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={openDeposit}
                className="flex h-14 w-28 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 text-xs font-medium hover:bg-neutral-50"
              >
                <ArrowDownLeft className="h-4 w-4" /> Buy
              </button>
              <button
                onClick={() => navigate(`/app/gifts/create?asset=${asset.id}`)}
                className="flex h-14 w-28 flex-col items-center justify-center gap-1 rounded-2xl bg-brand-600 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Gift className="h-4 w-4" /> Gift
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-sm text-neutral-500">Your balance</p>
              <p className="mt-1 text-2xl font-semibold">
                {fmtUsd(held * asset.price)}{" "}
                <span className="text-base font-normal text-neutral-400">
                  ({fmtAmount(held)} {asset.symbol})
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-sm text-neutral-500">About</p>
              <p className="mt-1 text-sm text-neutral-700">{DESCRIPTIONS[asset.id]}</p>
              <a href="#" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                View project <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Price</h2>
            <div className="flex gap-1 rounded-full bg-surface p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${range === r ? "bg-white text-ink ring-1 ring-neutral-200" : "text-neutral-500"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Chart seed={asset.id + range} />
          </div>
          <p className="mt-2 text-center text-xs text-neutral-400">Sample chart. Live prices coming soon.</p>
        </section>
      </main>
    </div>
  );
}
