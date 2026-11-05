import { Asset, BASE_FEE, Horizon, Networks, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import { HORIZON_URL, TOKEN_ISSUERS, type SignHash } from "./gift";

/**
 * Sends a token from the user's wallet to any Stellar address (withdraw).
 * Self-contained: signing is passed in, so it runs with Privy in the app and
 * with a plain keypair in tests.
 */
const toBase64 = (b: Uint8Array) => {
  let bin = "";
  b.forEach((x) => (bin += String.fromCharCode(x)));
  return btoa(bin);
};

/** Pulls the useful part out of a Horizon rejection. */
function horizonMessage(e: unknown): string {
  const codes = (e as { response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } } })?.response?.data
    ?.extras?.result_codes;
  const op = codes?.operations?.[0];
  if (op === "op_underfunded") return "Not enough balance in your wallet.";
  if (op === "op_low_reserve") return "That would leave your wallet below the minimum XLM it must keep.";
  if (op === "op_no_trust") return "The destination wallet hasn't enabled this token yet.";
  if (op === "op_no_destination") return "The destination wallet isn't active yet.";
  if (codes?.transaction === "tx_insufficient_balance") return "Not enough XLM left to pay the network fee.";
  return e instanceof Error ? e.message : "The transfer failed";
}

export const isStellarAddress = (s: string) => StrKey.isValidEd25519PublicKey(s.trim());

export async function sendPaymentOnChain(opts: {
  source: string;
  destination: string;
  tokenId: string;
  /** Whole tokens, e.g. 2.5 */
  amount: number;
  sign: SignHash;
}): Promise<{ txHash: string }> {
  const destination = opts.destination.trim();
  if (!isStellarAddress(destination)) throw new Error("That doesn't look like a Stellar address. It starts with G and is 56 characters long.");
  if (destination === opts.source) throw new Error("That's your own wallet address.");
  if (!(opts.amount > 0)) throw new Error("Enter an amount above zero.");

  const symbol = opts.tokenId.toUpperCase();
  let asset: Asset;
  if (opts.tokenId === "xlm") asset = Asset.native();
  else if (TOKEN_ISSUERS[opts.tokenId]) asset = new Asset(symbol, TOKEN_ISSUERS[opts.tokenId]);
  else throw new Error(`Unsupported token: ${symbol}`);

  const server = new Horizon.Server(HORIZON_URL);

  // Check the destination first, so the person gets a clear message instead of a failed transaction.
  let destExists = true;
  let destCanHold = true;
  try {
    const dest = await server.loadAccount(destination);
    destCanHold =
      asset.isNative() ||
      dest.balances.some((b) => {
        const t = b as { asset_code?: string; asset_issuer?: string };
        return t.asset_code === asset.code && t.asset_issuer === asset.issuer;
      });
  } catch (e) {
    if ((e as { response?: { status?: number } })?.response?.status === 404) destExists = false;
    else throw new Error("Couldn't reach the network. Try again.");
  }
  if (!destExists) {
    if (!asset.isNative()) throw new Error(`That wallet isn't active yet, so it can't receive ${symbol}. It needs some XLM first.`);
    if (opts.amount < 1) throw new Error("A wallet that isn't active yet needs at least 1 XLM to start.");
  } else if (!destCanHold) {
    throw new Error(`That wallet hasn't enabled ${symbol} yet, so it can't receive it.`);
  }

  const account = await server.loadAccount(opts.source);
  const amount = opts.amount.toFixed(7);
  // A wallet that doesn't exist yet is created by sending it XLM.
  const op = destExists
    ? Operation.payment({ destination, asset, amount })
    : Operation.createAccount({ destination, startingBalance: amount });

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(op).setTimeout(120).build();
  tx.addSignature(opts.source, toBase64(await opts.sign(tx.hash())));

  try {
    const res = await server.submitTransaction(tx);
    return { txHash: res.hash };
  } catch (e) {
    throw new Error(horizonMessage(e));
  }
}
