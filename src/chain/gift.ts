import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

/**
 * Creating and claiming gifts on the Lumecard contract (Stellar testnet).
 * Self-contained: the signing step is passed in, so the same code runs with a
 * Privy wallet in the app and with a plain keypair in tests.
 * Values must match lumecard/deployments/testnet.json.
 */
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const GIFT_CONTRACT = "CAWLQGYB74K7RE7ILXR7CODLC57NEH6H3XREPBRFKJBW562ONCE2643T";
export const TOKEN_CONTRACTS: Record<string, string> = {
  xlm: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  usdc: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  eurc: "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
};
/** Issuers of the non-native tokens (Circle, testnet). XLM has none. */
export const TOKEN_ISSUERS: Record<string, string> = {
  usdc: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  eurc: "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
};
/** A public, funded account (the contract admin) used only as the source of read-only calls. */
export const READ_ACCOUNT = "GBVATCX6JPNL5CCDUWMDTIW74LAH72WAR25G5W762H2TLRSYXB4BTPV5";
/** Fee the sender pays on top of the gift, in basis points (150 = 1.5%). Mirrors the contract. */
export const FEE_BPS = 150;
/** Stellar tokens have 7 decimal places. */
const DECIMALS = 7;

/** Signs a 32-byte transaction hash and returns the 64-byte Ed25519 signature. */
export type SignHash = (hash: Uint8Array) => Promise<Uint8Array>;

export interface CreatedGift {
  /** True if the sender put XLM in a purse so a brand-new recipient can set up their wallet. */
  purse?: boolean;
  /** The gift key's secret ("S..."). Goes in the gift link, never on-chain. */
  secret: string;
  /** The gift key's public half, as hex. This identifies the gift on-chain. */
  giftKeyHex: string;
  txHash: string;
  expiresAt: number;
}

export const toStroops = (amount: number): bigint => BigInt(Math.round(amount * 10 ** DECIMALS));

export const feeFor = (amount: number): number => (amount * FEE_BPS) / 10_000;

/**
 * Optional wallet "purse": for a recipient whose wallet doesn't exist on the network yet, the
 * sender can put this much XLM in a small account tied to the gift's key. The recipient's browser
 * uses it to create their wallet and hands them all of it, so no server is needed. It goes to the
 * recipient, not to Lumecard. (2 XLM because the purse must keep 1 XLM of its own while it creates
 * the wallet; it is all handed over afterwards.)
 */
export const PURSE_XLM = 2;
/** A hair over PURSE_XLM, to cover the transaction fees. */
const PURSE_FUNDING = "2.0010000";
/**
 * XLM to leave in the wallet for network fees and Stellar's minimum balance, on top of
 * the setup fee. Not a fee Lumecard charges.
 */
export const XLM_BUFFER = 2;
/** Smallest gift per token, in whole tokens (about $1.50). Mirrors the contract (set_min_gift). */
export const MIN_GIFT: Record<string, number> = { xlm: 9, usdc: 1.5, eurc: 1.4 };

export const minGiftTokens = (tokenId: string): number => MIN_GIFT[tokenId] ?? 0;
export const isGiftTooSmall = (tokenId: string, amount: number): boolean => amount < minGiftTokens(tokenId);

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

const toBase64 = (b: Uint8Array) => {
  let bin = "";
  b.forEach((x) => (bin += String.fromCharCode(x)));
  return btoa(bin);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turns raw network errors into something a person can act on. */
export function friendlyError(e: unknown): string {
  // Classic (non-contract) transactions are rejected with result codes.
  const codes = (e as { response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } } })?.response?.data
    ?.extras?.result_codes;
  if (codes) {
    const all = [...(codes.operations ?? []), codes.transaction ?? ""].join(" ");
    if (/op_already_exists/.test(all)) return "That wallet is already active.";
    if (/op_underfunded|op_low_reserve|tx_insufficient_balance/.test(all)) return "There isn't enough XLM for that.";
    if (/op_no_destination|op_no_source_account/.test(all)) return "That wallet or purse doesn't exist.";
    if (/tx_bad_auth/.test(all)) return "That wasn't authorised.";
    return "The network rejected the transaction.";
  }
  const msg = e instanceof Error ? e.message : String(e);
  // Why the network refused to even accept a transaction (see signAndSend).
  if (/txInsufficientBalance/.test(msg)) return "Your wallet doesn't have enough spare XLM to pay the network fee. Part of your XLM is locked as Stellar's minimum balance.";
  if (/txInsufficientFee/.test(msg)) return "The network is busy and needs a higher fee. Please try again in a moment.";
  if (/txBadSeq/.test(msg)) return "Your wallet was busy with another transaction. Please try again.";
  if (/txBadAuth/.test(msg)) return "Your wallet's signature wasn't accepted. Please try again.";
  if (/txTooLate|txTooEarly/.test(msg)) return "That took too long. Please try again.";
  if (/Error\(Contract, #5\)/.test(msg)) return "This gift has already been claimed or returned.";
  if (/Error\(Contract, #6\)/.test(msg)) return "This gift has expired.";
  if (/Error\(Contract, #7\)/.test(msg)) return "This gift hasn't expired yet.";
  if (/trustline entry is missing/i.test(msg)) return "Your wallet needs to enable this token first.";
  if (/account not found|not found/i.test(msg) && /account/i.test(msg)) return "Your wallet isn't active yet. Send it a little XLM first.";
  if (/insufficient|underfunded|balance is not sufficient/i.test(msg)) return "Not enough balance in your wallet.";
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

/** Signs with the wallet, submits, and waits for the network to confirm. Returns the tx hash. */
async function signAndSend(
  server: rpc.Server,
  built: ReturnType<TransactionBuilder["build"]>,
  signer: string,
  sign: SignHash,
): Promise<string> {
  // Asks the network to work out fees and resources; throws a readable error if the call would fail.
  const tx = await server.prepareTransaction(built);
  tx.addSignature(signer, toBase64(await sign(tx.hash())));

  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    // The network says why in a result code, e.g. "txBadSeq" or "txBadAuth".
    let code = "";
    try {
      // The result serialises to e.g. "tx_insufficient_balance"; turn it into "txInsufficientBalance".
      const json = JSON.parse(JSON.stringify(sent.errorResult ?? {}, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as {
        result?: unknown;
      };
      const r = json.result;
      const snake = typeof r === "string" ? r : r && typeof r === "object" ? Object.keys(r)[0] ?? "" : "";
      code = snake.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
    } catch {
      /* no readable code */
    }
    const err = new Error(`The network rejected the transaction${code ? ` (${code})` : ""}`) as Error & { code?: string };
    err.code = code;
    throw err;
  }

  for (let i = 0; i < 30; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === "SUCCESS") return sent.hash;
    if (res.status === "FAILED") throw new Error("The transaction failed on the network");
    await sleep(1000);
  }
  throw new Error("Timed out waiting for the network. Check your balance before trying again.");
}

export async function createGiftOnChain(opts: {
  sender: string;
  tokenId: string;
  /** Gift amount in whole tokens (e.g. 5 for 5 USDC). The 1.5% fee is added by the contract. */
  amount: number;
  expiresAt: number;
  /** Also pay the 1 XLM wallet-setup fee, for a recipient whose wallet doesn't exist yet. Optional. */
  withSetup?: boolean;
  /** Use this gift key (an "S..." secret) instead of making a new one. */
  giftSecret?: string;
  sign: SignHash;
}): Promise<CreatedGift> {
  const tokenContract = TOKEN_CONTRACTS[opts.tokenId];
  if (!tokenContract) throw new Error(`Unsupported token: ${opts.tokenId}`);
  if (!(opts.amount > 0)) throw new Error("Enter an amount above zero");

  const server = new rpc.Server(SOROBAN_RPC_URL);
  // One-time key: public half on-chain, secret in the link.
  const giftKeypair = opts.giftSecret ? Keypair.fromSecret(opts.giftSecret) : Keypair.random();

  const account = await server.getAccount(opts.sender);
  const call = new Contract(GIFT_CONTRACT).call(
    "create_gift",
    new Address(opts.sender).toScVal(),
    new Address(tokenContract).toScVal(),
    nativeToScVal(toStroops(opts.amount), { type: "i128" }),
    xdr.ScVal.scvBytes(giftKeypair.rawPublicKey()),
    nativeToScVal(BigInt(opts.expiresAt), { type: "u64" }),
    nativeToScVal(opts.withSetup === true, { type: "bool" }),
  );
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(call)
    .setTimeout(120)
    .build();

  const txHash = await signAndSend(server, built, opts.sender, opts.sign);
  return {
    secret: giftKeypair.secret(),
    giftKeyHex: toHex(giftKeypair.rawPublicKey()),
    txHash,
    expiresAt: opts.expiresAt,
  };
}

/** True if the contract still holds this gift (not claimed or returned yet). Read-only, free. */
export async function isGiftHeld(giftKeyHex: string, server = new rpc.Server(SOROBAN_RPC_URL)): Promise<boolean> {
  const bytes = Uint8Array.from(giftKeyHex.match(/.{2}/g)!, (h) => parseInt(h, 16));
  const tx = new TransactionBuilder(new Account(READ_ACCOUNT, "0"), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(GIFT_CONTRACT).call("get_gift", nativeToScVal(bytes)))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error("Could not check the gift");
  return scValToNative(sim.result.retval) != null;
}

/** The public half of a gift secret, as hex. Throws if the secret isn't valid. */
export const giftKeyHexFromSecret = (secret: string) => toHex(Keypair.fromSecret(secret).rawPublicKey());

/**
 * Claims a gift into `recipient`'s wallet. The gift's secret key (from the link) signs
 * "pay this recipient"; the recipient's wallet then submits the transaction and pays the
 * small network fee. The recipient's account must already exist and hold some XLM.
 */
export async function claimGiftOnChain(opts: { recipient: string; secret: string; sign: SignHash }): Promise<{ txHash: string }> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const giftKeypair = Keypair.fromSecret(opts.secret);
  const giftKey = giftKeypair.rawPublicKey();
  const contract = new Contract(GIFT_CONTRACT);
  const recipientScVal = new Address(opts.recipient).toScVal();

  // The contract tells us the exact bytes to sign, so the format can't drift from the contract.
  const payloadTx = new TransactionBuilder(new Account(opts.recipient, "0"), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(contract.call("claim_payload", xdr.ScVal.scvBytes(giftKey), recipientScVal))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(payloadTx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new Error("Could not prepare the claim");
  const payload = scValToNative(sim.result.retval) as Uint8Array;
  const giftSignature = giftKeypair.sign(payload as Buffer);

  const account = await server.getAccount(opts.recipient);
  const call = contract.call("claim", xdr.ScVal.scvBytes(giftKey), recipientScVal, xdr.ScVal.scvBytes(giftSignature));
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(call)
    .setTimeout(120)
    .build();

  return { txHash: await signAndSend(server, built, opts.recipient, opts.sign) };
}

/* ------------------------------------------------------------------------------------------
 * The purse: a small account tied to the gift key that sets up a brand-new recipient's wallet.
 * ------------------------------------------------------------------------------------------ */

const horizon = () => new Horizon.Server(HORIZON_URL);

const is404 = (e: unknown) => (e as { response?: { status?: number } })?.response?.status === 404;

const fromHex = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));

/** The purse's Stellar address: the gift key's public half, as an account address. */
export const purseAddressFor = (giftKeyHex: string): string => StrKey.encodeEd25519PublicKey(fromHex(giftKeyHex) as Buffer);

/** XLM held by the gift's purse, or null if there is no purse (never funded, or already used). */
export async function getPurseBalance(giftKeyHex: string): Promise<number | null> {
  try {
    const acct = await horizon().loadAccount(purseAddressFor(giftKeyHex));
    return Number(acct.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
  } catch (e) {
    if (is404(e)) return null;
    throw new Error("Couldn't reach the network. Try again.");
  }
}

/** A fresh gift key, as an "S..." secret. */
export const newGiftSecret = (): string => Keypair.random().secret();

/**
 * Sender puts PURSE_XLM into the purse. The sender is also made a signer on it, so they can always
 * close it and take the XLM back if the gift is never claimed. One transaction, signed by the
 * sender's wallet and by the gift key.
 */
export async function fundPurseOnChain(opts: { sender: string; giftSecret: string; sign: SignHash }): Promise<void> {
  const h = horizon();
  const purse = Keypair.fromSecret(opts.giftSecret);
  const tx = new TransactionBuilder(await h.loadAccount(opts.sender), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.createAccount({ destination: purse.publicKey(), startingBalance: PURSE_FUNDING }))
    .addOperation(Operation.setOptions({ source: purse.publicKey(), signer: { ed25519PublicKey: opts.sender, weight: 1 } }))
    .setTimeout(120)
    .build();
  tx.sign(purse);
  tx.addSignature(opts.sender, toBase64(await opts.sign(tx.hash())));
  await h.submitTransaction(tx);
}

/**
 * Recipient side: use the purse to create `recipient`'s wallet and hand over everything in it.
 * Signed only by the gift key (from the link), so the recipient needs no XLM and no server.
 */
export async function activateWalletFromPurse(opts: { giftSecret: string; recipient: string }): Promise<void> {
  const h = horizon();
  const purse = Keypair.fromSecret(opts.giftSecret);
  const account = await h.loadAccount(purse.publicKey());
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET });
  // Remove the sender's recovery signer first: it costs the purse reserve it needs to create the wallet.
  for (const s of account.signers) {
    if (s.key !== purse.publicKey() && s.weight > 0) {
      builder.addOperation(Operation.setOptions({ signer: { ed25519PublicKey: s.key, weight: 0 } }));
    }
  }
  const tx = builder
    .addOperation(Operation.createAccount({ destination: opts.recipient, startingBalance: "1" }))
    .addOperation(Operation.accountMerge({ destination: opts.recipient })) // everything left goes to the recipient
    .setTimeout(120)
    .build();
  tx.sign(purse);
  await h.submitTransaction(tx);
}

/** Sender takes the XLM back out of an unused purse. Returns false if there is no purse. */
export async function recoverPurseOnChain(opts: { sender: string; giftKeyHex: string; sign: SignHash }): Promise<boolean> {
  const h = horizon();
  const purseAddress = purseAddressFor(opts.giftKeyHex);
  if ((await getPurseBalance(opts.giftKeyHex)) === null) return false;
  const tx = new TransactionBuilder(await h.loadAccount(opts.sender), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.accountMerge({ source: purseAddress, destination: opts.sender }))
    .setTimeout(120)
    .build();
  tx.addSignature(opts.sender, toBase64(await opts.sign(tx.hash())));
  await h.submitTransaction(tx);
  return true;
}

/** Sender takes an expired, unclaimed gift back (and the purse's XLM, if there is one). */
export async function takeBackGiftOnChain(opts: { sender: string; giftKeyHex: string; sign: SignHash }): Promise<void> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(opts.sender);
  const call = new Contract(GIFT_CONTRACT).call("refund", xdr.ScVal.scvBytes(fromHex(opts.giftKeyHex) as Buffer));
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(call)
    .setTimeout(120)
    .build();
  await signAndSend(server, built, opts.sender, opts.sign);
  await recoverPurseOnChain(opts);
}

/**
 * Creates a gift, optionally with a purse for a recipient whose wallet doesn't exist yet.
 * If the gift can't be created after the purse was funded, the purse XLM is taken straight back.
 */
export async function createGiftWithPurse(opts: {
  sender: string;
  tokenId: string;
  amount: number;
  expiresAt: number;
  withPurse: boolean;
  sign: SignHash;
}): Promise<CreatedGift> {
  const giftSecret = newGiftSecret();
  const giftKeyHex = giftKeyHexFromSecret(giftSecret);
  if (opts.withPurse) await fundPurseOnChain({ sender: opts.sender, giftSecret, sign: opts.sign });
  try {
    const gift = await createGiftOnChain({
      sender: opts.sender,
      tokenId: opts.tokenId,
      amount: opts.amount,
      expiresAt: opts.expiresAt,
      giftSecret,
      sign: opts.sign,
    });
    return { ...gift, purse: opts.withPurse };
  } catch (e) {
    if (opts.withPurse) {
      await recoverPurseOnChain({ sender: opts.sender, giftKeyHex, sign: opts.sign }).catch(() => {});
    }
    throw e;
  }
}
