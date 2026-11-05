import { useCallback, useState } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useAuth } from "../auth/AuthProvider";
import { useBalances } from "./Balances";
import { claimGiftOnChain, friendlyError, type SignHash } from "./gift";

const bytesToHex = (bytes: Uint8Array): `0x${string}` =>
  `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

const hexToBytes = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Uint8Array.from(clean.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));
};

/** Claims a gift into the signed-in user's own wallet, signed by that wallet. */
export function useClaimGift() {
  const { stellarAddress } = useAuth();
  const { refresh } = useBalances();
  const { signRawHash } = useSignRawHash();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const claim = useCallback(
    async (secret: string): Promise<string | null> => {
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
        const { txHash } = await claimGiftOnChain({ recipient: stellarAddress, secret, sign });
        refresh(); // the gift is now in the wallet
        return txHash;
      } catch (e) {
        console.error("Claim failed", e);
        setError(friendlyError(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [stellarAddress, signRawHash, refresh],
  );

  return { claim, busy, error };
}
