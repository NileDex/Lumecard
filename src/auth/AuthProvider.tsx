import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";

/**
 * Sign-in for Lumecard, backed by Privy.
 *  - "Continue with email" opens Privy's own login modal.
 *  - After login, the user gets a Privy embedded **Stellar** wallet (created once).
 * The wallet is the user's own; Lumecard never holds funds.
 */

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;
/** Optional: Privy "client ID" for this web client (Privy dashboard, Clients tab). */
export const PRIVY_CLIENT_ID = (import.meta.env.VITE_PRIVY_CLIENT_ID as string | undefined) || undefined;

interface AuthState {
  /** Privy SDK has finished loading */
  ready: boolean;
  authenticated: boolean;
  email?: string;
  /** The user's Stellar wallet address (G...), once created */
  stellarAddress?: string;
  /** True while the Stellar wallet is being created after first login */
  creatingWallet: boolean;
  /** False when no Privy app ID is configured */
  configured: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  ready: true,
  authenticated: false,
  creatingWallet: false,
  configured: false,
  login: () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Wraps the app with Privy (when configured) and exposes a simple auth state. */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    console.warn("VITE_PRIVY_APP_ID is not set. Add it to client/.env.local to enable login.");
    return (
      <AuthContext.Provider
        value={{
          ready: true,
          authenticated: false,
          creatingWallet: false,
          configured: false,
          login: () => alert("Login isn't configured yet: set VITE_PRIVY_APP_ID in client/.env.local"),
          logout: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    // Login methods and modal look come from the Privy dashboard, not from code.
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProvider>
  );
}

type WalletLike = { type?: string; chainType?: string; address?: string };

function findStellarAddress(linkedAccounts: unknown[] | undefined): string | undefined {
  const w = (linkedAccounts as WalletLike[] | undefined)?.find((a) => a.type === "wallet" && a.chainType === "stellar");
  return w?.address;
}

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [createdAddress, setCreatedAddress] = useState<string>();
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const creating = useRef(false);

  // Privy reports login problems as a code. Show it, so a failure isn't silent.
  const { login } = useLogin({
    onComplete: () => setAuthError(undefined),
    onError: (code) => {
      console.error("Privy login error:", code);
      // Closing the login window also reports an error; that's not a problem.
      if (String(code) !== "exited_auth_flow") setAuthError(String(code));
    },
  });

  const linkedAddress = findStellarAddress(user?.linkedAccounts);
  const stellarAddress = linkedAddress ?? createdAddress;

  // First login: give the user a Stellar wallet (once).
  useEffect(() => {
    if (!ready || !authenticated || stellarAddress || creating.current) return;
    creating.current = true;
    setCreatingWallet(true);
    createWallet({ chainType: "stellar" })
      .then(({ wallet }) => setCreatedAddress(wallet.address))
      .catch((err) => {
        console.error("Could not create Stellar wallet", err);
        setAuthError(`Could not create your Stellar wallet${err instanceof Error && err.message ? `: ${err.message}` : ""}`);
      })
      .finally(() => {
        creating.current = false;
        setCreatingWallet(false);
      });
  }, [ready, authenticated, stellarAddress, createWallet]);

  const doLogout = useCallback(async () => {
    setCreatedAddress(undefined);
    await logout();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        ready,
        authenticated,
        email: user?.email?.address,
        stellarAddress,
        creatingWallet,
        configured: true,
        login: () => login(),
        logout: doLogout,
      }}
    >
      {children}
      {authError && (
        <div role="alert" className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink p-4 text-sm text-white">
          <p className="flex-1 break-words">
            <span className="block font-semibold">Sign-in problem</span>
            <span className="mt-0.5 block text-white/80">{authError}</span>
          </p>
          <button onClick={() => setAuthError(undefined)} className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold">
            Close
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
}
