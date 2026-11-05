import { useCallback } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useAuth } from "../auth/AuthProvider";
import type { SignHash } from "./gift";

const bytesToHex = (bytes: Uint8Array): `0x${string}` =>
  `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

const hexToBytes = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Uint8Array.from(clean.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));
};

/** A signer backed by the signed-in user's Privy wallet, or null until the wallet exists. */
export function usePrivySigner(): SignHash | null {
  const { stellarAddress } = useAuth();
  const { signRawHash } = useSignRawHash();
  const sign = useCallback<SignHash>(
    async (hash) => {
      const { signature } = await signRawHash({ address: stellarAddress!, chainType: "stellar", hash: bytesToHex(hash) });
      return hexToBytes(signature);
    },
    [stellarAddress, signRawHash],
  );
  return stellarAddress ? sign : null;
}
