import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, Gift, Inbox, Send } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { AssetIcon } from "../components/AssetIcon";
import { useDeposit } from "../components/DepositModal";
import { TestnetFunding } from "../components/TestnetFunding";
import { useWithdraw } from "../components/WithdrawModal";
import { SentGifts } from "../components/SentGifts";
import { ASSETS, fmtPrice } from "../data/assets";
import { fmtAmount, fmtUsd, useBalances } from "../chain/Balances";

const ACTIONS = [
  { id: "gift", label: "Send gift", icon: Gift, to: "/app/gifts/create" },
  { id: "deposit", label: "Deposit", icon: ArrowDownLeft },
  { id: "withdraw", label: "Withdraw", icon: ArrowUpRight },
];

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Inbox; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-neutral-500">{body}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { openDeposit } = useDeposit();
  const { openWithdraw } = useWithdraw();
  const { amounts, totalUsd, tokenCount, loading, funded, error } = useBalances();
  const holdings = ASSETS.filter((a) => (amounts[a.id] ?? 0) > 0);

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <Header signedIn />
      <main className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6">
        {/* Balance */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-[#2a1a12] to-brand-700 p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-white/60">
                Total balance <Eye className="h-3.5 w-3.5" />
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                {loading ? <span className="inline-block h-10 w-40 animate-pulse rounded-lg bg-white/15 align-middle" /> : fmtUsd(totalUsd)}
              </p>
              <p className="mt-1 text-sm text-white/50">
                {error
                  ? "Couldn't reach the network. Retrying…"
                  : !funded
                    ? "Wallet not active yet. Deposit XLM to activate it."
                    : `Across ${tokenCount} ${tokenCount === 1 ? "token" : "tokens"}`}
              </p>
            </div>
            <div className="flex gap-3">
              {ACTIONS.map(({ id, label, icon: Icon, to }) => {
                const primary = id === "gift";
                return (
                  <button
                    key={id}
                    onClick={() => (to ? navigate(to) : id === "deposit" ? openDeposit() : openWithdraw())}
                    className="group flex flex-col items-center gap-2"
                  >
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-2xl transition ${
                        primary ? "bg-white text-brand-700 group-hover:bg-brand-50" : "bg-white/10 text-white ring-1 ring-white/15 group-hover:bg-white/20"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs text-white/80">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <TestnetFunding />

        {/* Tokens */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Popular tokens</h2>
            <button className="flex items-center gap-0.5 text-sm font-medium text-neutral-500 hover:text-brand-600">
              See all <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {ASSETS.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/app/token/${a.id}`)}
                className="flex w-[120px] shrink-0 flex-col items-start rounded-2xl border border-neutral-200/80 bg-white p-3.5 text-left"
              >
                <AssetIcon asset={a} size="md" />
                <span className="mt-3 text-sm font-semibold">{a.symbol}</span>
                <span className="text-xs text-neutral-500">{fmtPrice(a.price)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Portfolio + gifts */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">My portfolio</h2>
            {holdings.length > 0 ? (
              <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
                {holdings.map((a) => {
                  const amt = amounts[a.id];
                  return (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/app/token/${a.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <AssetIcon asset={a} />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{a.name}</span>
                        <span className="block text-xs text-neutral-500">
                          {fmtAmount(amt)} {a.symbol}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">{fmtUsd(amt * a.price)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Inbox}
                title="Nothing here yet"
                body="Grow your portfolio by receiving gifts or depositing tokens."
                action={
                  <button onClick={openDeposit} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold hover:bg-neutral-50">
                    Deposit tokens
                  </button>
                }
              />
            )}
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Sent gifts</h2>
            <SentGifts
              empty={
                <EmptyState
                  icon={Send}
                  title="No gifts sent"
                  body="Send crypto to anyone with just a link."
                  action={
                    <Link to="/app/gifts/create" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                      Send your first gift
                    </Link>
                  }
                />
              }
            />
          </section>
        </div>
      </main>
    </div>
  );
}
