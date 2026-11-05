import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Globe, LogOut, PieChart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useDeposit } from "./DepositModal";
import { useWithdraw } from "./WithdrawModal";
import { useConnectWallet } from "./ConnectWallet";
import { useAuth } from "../auth/AuthProvider";
import { fmtUsd, useBalances } from "../chain/Balances";

const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-6)}` : "Creating wallet…");

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { openDeposit } = useDeposit();
  const { openWithdraw } = useWithdraw();
  const { email, stellarAddress, logout } = useAuth();
  const { totalUsd } = useBalances();
  const label = email ?? shortAddr(stellarAddress);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const items = [
    { icon: PieChart, label: "My portfolio", onClick: () => navigate("/app") },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-1 pr-3 text-sm text-neutral-700 hover:border-neutral-300"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
          {(email?.[0] ?? "L").toUpperCase()}
        </span>
        <span className="hidden max-w-[200px] truncate sm:inline">{label}</span>
        <ChevronDown className={`h-4 w-4 text-neutral-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-pop absolute right-0 mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl shadow-black/5">
          <div className="rounded-xl bg-surface px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Wallet balance</span>
              <span className="font-semibold">{fmtUsd(totalUsd)}</span>
            </div>
            <button
              disabled={!stellarAddress}
              onClick={() => {
                if (!stellarAddress) return;
                navigator.clipboard?.writeText(stellarAddress).catch(() => {});
                setCopied(true);
              }}
              className="mt-1.5 flex w-full items-center justify-between font-mono text-xs text-neutral-500"
              title="Copy wallet address"
            >
              {shortAddr(stellarAddress)}
              {stellarAddress &&
                (copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />)}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setOpen(false);
                openDeposit();
              }}
              className="h-10 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Deposit
            </button>
            <button
              onClick={() => {
                setOpen(false);
                openWithdraw();
              }}
              className="h-10 rounded-xl border border-neutral-200 text-sm font-semibold"
            >
              Withdraw
            </button>
          </div>
          <div className="my-2 h-px bg-neutral-100" />
          {items.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              onClick={() => {
                setOpen(false);
                onClick?.();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Icon className="h-4 w-4 text-neutral-500" /> {label}
            </button>
          ))}
          <div className="my-2 h-px bg-neutral-100" />
          <button
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
          >
            <LogOut className="h-4 w-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

/** `signedIn` is ignored: the header follows the real Privy session. */
export function Header(_props: { signedIn?: boolean }) {
  const { openConnect } = useConnectWallet();
  const { authenticated } = useAuth();
  const signedIn = authenticated;
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-4 sm:px-6">
        <Link to={signedIn ? "/app" : "/"}>
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <button className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-100">
            <Globe className="h-3.5 w-3.5" /> EN
          </button>
          {signedIn ? (
            <AccountMenu />
          ) : (
            <button
              onClick={() => openConnect(() => navigate("/app"))}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.4)]"
            >
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
