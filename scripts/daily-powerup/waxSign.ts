// Wharfkit Session built from a private key (no wallet UI).

import { Session, PrivateKey, Chains } from "@wharfkit/session";
import { WalletPluginPrivateKey } from "@wharfkit/wallet-plugin-privatekey";
import { ENDPOINTS } from "./waxRpc";

export function createSession(actor: string, permission: string, privateKeyWif: string): Session {
  PrivateKey.from(privateKeyWif); // validate early

  const wallet = new WalletPluginPrivateKey(privateKeyWif);

  return new Session(
    {
      chain: Chains.WAX,
      actor,
      permission,
      walletPlugin: wallet,
    },
    {
      // Multi-endpoint fallback for chain RPC calls.
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const isChain = url.includes("/v1/chain/");
        if (!isChain) return fetch(input, init);
        const path = url.slice(url.indexOf("/v1/"));
        let lastErr: unknown = null;
        for (const ep of ENDPOINTS) {
          try {
            const r = await fetch(ep + path, init);
            if (r.ok) return r;
            lastErr = new Error(`HTTP ${r.status}`);
          } catch (e) {
            lastErr = e;
          }
        }
        throw new Error(`All RPC endpoints failed for ${path}: ${String(lastErr)}`);
      },
    }
  );
}

export interface TransferAction {
  from: string;
  to: string;
  quantity: string;
  memo: string;
}

export function buildTransferAction(session: Session, t: TransferAction) {
  return {
    account: "cheeseburger",
    name: "transfer",
    authorization: [{ actor: String(session.actor), permission: String(session.permission) }],
    data: t,
  };
}

/** Submit a transaction of one or more actions. Returns the tx id. */
export async function submitActions(
  session: Session,
  actions: ReturnType<typeof buildTransferAction>[]
): Promise<string> {
  const result = await session.transact({ actions });
  const id = result.resolved?.transaction.id?.toString();
  if (!id) throw new Error("No transaction id returned");
  return id;
}