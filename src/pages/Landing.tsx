import { Gift, Link2, Wallet } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useAuth } from "../auth/AuthProvider";
import { useConnectWallet } from "../components/ConnectWallet";
import { AssetIcon } from "../components/AssetIcon";
import { LogoMark } from "../components/Logo";
import { getAsset, type Asset } from "../data/assets";

function HeroCard({ asset, label, className, rotate }: { asset: Asset; label: string; className: string; rotate: string }) {
  return (
    <div
      className={`animate-float absolute aspect-[1.6/1] w-[230px] rounded-2xl bg-gradient-to-br p-4 text-white shadow-2xl min-[420px]:w-[290px] min-[420px]:p-5 sm:w-[340px] ${asset.gradient} ${className}`}
      style={{ ["--r" as string]: rotate, transform: `rotate(${rotate})` }}
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest opacity-80">
        <span>Gift card</span>
        <span className="flex items-center gap-1 normal-case tracking-normal">
          <LogoMark className="h-4 w-4" /> Lumecard
        </span>
      </div>
      {asset.icon ? (
        <img src={asset.icon} alt="" draggable={false} className="mt-4 h-16 w-16 rounded-full bg-white/90 p-0.5" />
      ) : (
        <div className="mt-4 text-6xl font-black drop-shadow">{asset.glyph}</div>
      )}
      <div className="absolute bottom-4 right-5 text-lg font-bold uppercase tracking-widest">{label}</div>
    </div>
  );
}

const SAMPLE_TILES = [
  { key: "usdc-100", id: "usdc", amount: "$100", bg: "from-sky-50 to-blue-100" },
  { key: "xlm-500", id: "xlm", amount: "500", bg: "from-neutral-50 to-neutral-200" },
  { key: "eurc-50", id: "eurc", amount: "€50", bg: "from-cyan-50 to-blue-100" },
  { key: "usdc-25", id: "usdc", amount: "$25", bg: "from-sky-50 to-blue-100" },
  { key: "xlm-1000", id: "xlm", amount: "1,000", bg: "from-neutral-50 to-neutral-200" },
  { key: "eurc-20", id: "eurc", amount: "€20", bg: "from-cyan-50 to-blue-100" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { authenticated, stellarAddress } = useAuth();
  const { openConnect } = useConnectWallet();

  // Signed in with a wallet (including after a Google/Discord redirect that
  // reloads the page): go to the dashboard.
  useEffect(() => {
    if (authenticated && stellarAddress) navigate("/app", { replace: true });
  }, [authenticated, stellarAddress, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-brand-50">
        <div className="mx-auto grid max-w-[1140px] items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="text-5xl font-medium leading-[1.1] tracking-tight sm:text-6xl">
              Gift crypto
              <br />
              without explaining it.
            </h1>
            <p className="mt-8 text-lg text-neutral-700">
              Send crypto as a gift card. They open a link and it's theirs to keep.
            </p>
            <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                onClick={() => openConnect(() => navigate("/app/gifts/create"))}
                className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)] sm:w-auto"
              >
                Create Your First Gift
              </button>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
                <span className="text-sm leading-none">✦</span> Built on Stellar
              </span>
            </div>
          </div>
          <div className="relative h-[340px]">
            <HeroCard asset={getAsset("xlm")!} label="Stellar" className="left-0 top-20 sm:left-4" rotate="22deg" />
            <HeroCard asset={getAsset("usdc")!} label="USDC" className="right-0 top-2" rotate="-14deg" />
          </div>
        </div>
      </section>

      {/* Tokens */}
      <section className="mx-auto grid max-w-[1140px] items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-medium tracking-tight">Gift the tokens people want</h2>
          <p className="mt-4 text-neutral-700">
            Digital dollars (USDC), digital euros (EURC) and Stellar's own coin (XLM). Fast, low-cost, and on the
            Stellar network.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[480px]">
          <div className="grid grid-cols-3 gap-3">
            {SAMPLE_TILES.map((t) => {
              const a = getAsset(t.id)!;
              return (
                <div key={t.key} className={`rounded-xl bg-gradient-to-br p-3 shadow-sm ${t.bg}`}>
                  <AssetIcon asset={a} size="sm" />
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-lg font-semibold">{t.amount}</span>
                    <span className="text-[10px] uppercase text-neutral-600">{a.symbol}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface">
        <div className="mx-auto max-w-[1140px] px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-medium tracking-tight">How it works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Gift, title: "Pick a token", body: "Choose USDC, EURC or XLM on Stellar." },
              { icon: Link2, title: "Send a link", body: "Share a gift link or send it straight to an inbox." },
              { icon: Wallet, title: "They claim it", body: "It lands in their own wallet. They can hold it or withdraw anytime." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl bg-white p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-[1140px] flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Lumecard</span>
          <div className="flex gap-6">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
