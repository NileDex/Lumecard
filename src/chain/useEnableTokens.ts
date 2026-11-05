import { useCallback, useState } from "react";
import { Asset, BASE_FEE, Horizon, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useAuth } from "../auth/AuthProvider";
import { HORIZON_URL, useBalances } from "./Balances";
import { friendlyError } from "./gift";

/**
 * Lets the user's Privy wallet opt in to USDC and EURC ("trustlines").
 * On Stellar an account can't hold a token until it opts in, and the opt-in
 * has to be signed by the account itself, so this signs with Privy's wallet.
 *
 * Testnet issuers (Circle). Must match lumecard/deployments/testnet.json.
 */
const TRUSTLINE_ASSETS = [
  new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
  new Asset("EURC", "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO"),
];

const bytesToHex = (bytes: Uint8Array): `0x${string}` =>
  `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

const hexToBase64 = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  let bin = "";
  for (let i = 0; i < clean.length; i += 2) bin += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  return btoa(bin);
};

export function useEnableTokens() {
  const { stellarAddress } = useAuth();
  const { amounts, funded, refresh } = useBalances();
  const { signRawHash } = useSignRawHash();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Which of USDC / EURC the account has not opted in to yet.
  const missing = TRUSTLINE_ASSETS.filter((a) => amounts[a.code.toLowerCase()] === undefined);

  /**
   * Opt in to the missing tokens. Pass `only` (e.g. ["USDC"]) to enable just those: each opt-in locks
   * 0.5 XLM in the wallet, so a new wallet should only enable the one token it needs.
   */
  const enable = useCallback(async (only?: string[]) => {
    const targets = only ? missing.filter((a) => only.includes(a.code)) : missing;
    if (!stellarAddress || targets.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(stellarAddress);

      const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET });
      for (const asset of targets) builder.addOperation(Operation.changeTrust({ asset }));
      const tx = builder.setTimeout(120).build();

      // Privy signs the 32-byte transaction hash with the wallet's Ed25519 key.
      const { signature } = await signRawHash({
        address: stellarAddress,
        chainType: "stellar",
        hash: bytesToHex(tx.hash()),
      });
      tx.addSignature(stellarAddress, hexToBase64(signature));

      await server.submitTransaction(tx);
      refresh();
    } catch (e) {
      console.error("Enable tokens failed", e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }, [stellarAddress, missing, signRawHash, refresh]);

  return { missing: missing.map((a) => a.code), enable, busy, error, canEnable: funded && !!stellarAddress };
}
