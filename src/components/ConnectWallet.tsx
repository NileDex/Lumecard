import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Mail, Wallet, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

/**
 * "Connect to Lumecard" chooser.
 *  - Continue with email: closes this and opens Privy's own login modal.
 *  - Connect a Stellar wallet: coming soon (Stellar Wallets Kit).
 * Callers pass `onConnected`, which runs once the user is signed in and has a
 * Stellar wallet address.
 */
type OnConnected = (address: string) => void;

const ConnectContext = createContext<{ openConnect: (onConnected?: OnConnected) => void }>({
  openConnect: () => {},
});
export const useConnectWallet = () => useContext(ConnectContext);

export function ConnectWalletProvider({ children }: { children: ReactNode }) {
  const { authenticated, stellarAddress, login } = useAuth();
  const [open, setOpen] = useState(false);
  const pending = useRef<OnConnected | undefined>(undefined);

  // Once login finishes and the wallet exists, continue what the user was doing.
  useEffect(() => {
    if (authenticated && stellarAddress && pending.current) {
      const cb = pending.current;
      pending.current = undefined;
      cb(stellarAddress);
    }
  }, [authenticated, stellarAddress]);

  const openConnect = (cb?: OnConnected) => {
    if (authenticated && stellarAddress) {
      cb?.(stellarAddress); // already signed in
      return;
    }
    pending.current = cb;
    setOpen(true);
  };

  return (
    <ConnectContext.Provider value={{ openConnect }}>
      {children}
      {open && (
        <ConnectModal
          onClose={() => {
            pending.current = undefined;
            setOpen(false);
          }}
          onEmail={() => {
            setOpen(false); // hand over to Privy's modal
            login();
          }}
        />
      )}
    </ConnectContext.Provider>
  );
}

function ConnectModal({ onClose, onEmail }: { onClose: () => void; onEmail: () => void }) {
  const row = "flex w-full items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3.5 text-left";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-pop relative w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-500">
          <X className="h-5 w-5" />
        </button>

        <h2 className="pr-8 text-lg font-semibold">Connect to Lumecard</h2>
        <p className="mt-1 text-sm text-neutral-500">Your gifts go straight to your own wallet.</p>

        <div className="mt-5 space-y-2.5">
          <button onClick={onEmail} className={`${row} hover:border-brand-300`}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-neutral-700">
              <Mail className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Continue with email</span>
              <span className="block text-xs text-neutral-500">We create a wallet for you. Nothing to install.</span>
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </button>

          <div className={`${row} cursor-not-allowed opacity-60`} aria-disabled>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-neutral-700">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Connect a Stellar wallet</span>
              <span className="block text-xs text-neutral-500">Freighter, xBull, Lobstr and more</span>
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-neutral-500">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
