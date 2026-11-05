import { useCallback, useState } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useAuth } from "../auth/AuthProvider";
import { useBalances } from "./Balances";
import { createGiftWithPurse, type CreatedGift, type SignHash } from "./gift";

const DAY_SECONDS = 24 * 60 * 60;

const bytesToHex = (bytes: Uint8Array): `0x${string}` =>
  `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

const hexToBytes = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Uint8Array.from(clean.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));
};

/** Sends a real gift transaction, signed by the user's Privy wallet. */
export function useCreateGift() {
  const { stellarAddress } = useAuth();
  const { refresh } = useBalances();
  const { signRawHash } = useSignRawHash();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const create = useCallback(
    async (p: { tokenId: string; amount: number; expiryDays: number; withPurse: boolean }): Promise<CreatedGift | null> => {
      if (!stellarAddress) {
        setError("Your wallet isn't ready yet");
        return null;
      }
      setBusy(true);
      setError(undefined);
      try {
        const sign: SignHash = async (hash) => {
          const { signature } = await signRawHash({ address: stellarAddress, chainType: "stellar", hash: bytesToHex(hash) });
          return hexToBytes(signature);
        };
        const gift = await createGiftWithPurse({
          sender: stellarAddress,
          tokenId: p.tokenId,
          amount: p.amount,
          expiresAt: Math.floor(Date.now() / 1000) + p.expiryDays * DAY_SECONDS,
          withPurse: p.withPurse,
          sign,
        });
        refresh(); // balances now reflect the gift and fee
        return gift;
      } catch (e) {
        console.error("Create gift failed", e);
        setError(e instanceof Error ? e.message : "Something went wrong");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [stellarAddress, signRawHash, refresh],
  );

  return { create, busy, error };
}
