import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { GIFT_CONTRACT, HORIZON_URL, SOROBAN_RPC_URL, TOKEN_CONTRACTS, isGiftHeld } from "./gift";

/**
 * Reads the gifts a wallet has sent. The contract has no "gifts by sender" list,
 * so we read the wallet's own create_gift transactions from Horizon, then ask the
 * contract whether each gift is still waiting.
 */
export type GiftStatus = "waiting" | "expired" | "done";

export interface SentGift {
  giftKeyHex: string;
  tokenId: string;
  /** Gift amount in whole tokens (the fee is not included) */
  amount: number;
  expiresAt: number;
  createdAt: string;
  txHash: string;
  status: GiftStatus;
}

interface HorizonParam {
  type: string;
  value: string;
}
interface HorizonOp {
  type: string;
  transaction_hash: string;
  created_at: string;
  transaction_successful?: boolean;
  parameters?: HorizonParam[];
}

const tokenIdFor = (contract: string) => Object.entries(TOKEN_CONTRACTS).find(([, c]) => c === contract)?.[0];

const decode = (p: HorizonParam) => scValToNative(xdr.ScVal.fromXDR(p.value, "base64"));

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

type Parsed = Omit<SentGift, "status">;

/** Picks create_gift calls to our contract out of the wallet's operations. */
function parseOps(records: HorizonOp[], sender: string): Parsed[] {
  const out: Parsed[] = [];
  for (const op of records) {
    if (op.type !== "invoke_host_function" || op.transaction_successful === false || !op.parameters) continue;
    try {
      const [contract, fn, from, token, amount, key, expires] = op.parameters.map(decode);
      if (contract !== GIFT_CONTRACT || fn !== "create_gift" || from !== sender) continue;
      const tokenId = tokenIdFor(String(token));
      if (!tokenId) continue;
      out.push({
        giftKeyHex: hex(key as Uint8Array),
        tokenId,
        amount: Number(amount as bigint) / 1e7,
        expiresAt: Number(expires as bigint),
        createdAt: op.created_at,
        txHash: op.transaction_hash,
      });
    } catch {
      // not a call we understand; skip it
    }
  }
  return out;
}

export async function fetchSentGifts(sender: string, limit = 20): Promise<SentGift[]> {
  const res = await fetch(`${HORIZON_URL}/accounts/${sender}/operations?order=desc&limit=200&include_failed=false`);
  if (res.status === 404) return []; // wallet not active yet, so nothing sent
  if (!res.ok) throw new Error(`Network error ${res.status}`);
  const json = (await res.json()) as { _embedded: { records: HorizonOp[] } };

  const gifts = parseOps(json._embedded.records, sender).slice(0, limit);
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const now = Math.floor(Date.now() / 1000);

  return Promise.all(
    gifts.map(async (g): Promise<SentGift> => {
      const held = await isGiftHeld(g.giftKeyHex, server);
      const status: GiftStatus = !held ? "done" : now >= g.expiresAt ? "expired" : "waiting";
      return { ...g, status };
    }),
  );
}
