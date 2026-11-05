import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/** Gate for signed-in pages: waits for Privy, sends signed-out visitors home. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated } = useAuth();
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fafafb]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
      </div>
    );
  }
  if (!authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}
