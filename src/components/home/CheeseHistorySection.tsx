import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle } from 'lucide-react';

const VERIFICATION_URL = 'https://wax.cryptolions.io/v2/history/get_actions?filter=*%3Acreate&limit=5&skip=0&sort=asc';

// Verification logic based on the historical data:
// WAX token: Block 52, June 24, 2019 (native chain token)
// CHEESE token: Block 2156575, July 7, 2019 (first user-created token)
// Next token (DCART): Block 3074673, July 12, 2019
const IS_VERIFIED = true; // CHEESE is confirmed as first token after WAX

const HISTORY_JSON = `{
  "query_time_ms": 6074.695,
  "cached": false,
  "lib": 0,
  "last_indexed_block": 343745492,
  "last_indexed_block_time": "2024-12-04T22:08:01.500",
  "total": {
    "value": 10000,
    "relation": "gte"
  },
  "actions": [
    {
      "@timestamp": "2019-06-24T18:01:51.500",
      "timestamp": "2019-06-24T18:01:51.500",
      "block_num": 52,
      "trx_id": "adb4ec7140b83eef6e7f15781e74e17783c2311c69caa50de0c525f57f7bd347",
      "act": {
        "account": "eosio.token",
        "name": "create",
        "authorization": [
          {
            "actor": "eosio.token",
            "permission": "active"
          }
        ],
        "data": {
          "issuer": "eosio",
          "maximum_supply": "46116860184.27387903 WAX"
        }
      },
      "receipts": [
        {
          "receiver": "eosio.token",
          "global_sequence": 71,
          "recv_sequence": 1,
          "auth_sequence": [
            {
              "account": "eosio.token",
              "sequence": 3
            }
          ]
        }
      ],
      "cpu_usage_us": 149,
      "net_usage_words": 15,
      "account_ram_deltas": [
        {
          "account": "eosio.token",
          "delta": 264
        }
      ],
      "global_sequence": 71,
      "producer": "eosio",
      "action_ordinal": 1,
      "creator_action_ordinal": 0,
      "signatures": [
        "SIG_K1_KBsTUpSYTYWXm2p6Qr2KrpxAsLj4edoNyTkECFnzgiknnBinSo9mKUtq7bPqHtTBmShD86nbfhu34U9b9HcvBjxHexrow2"
      ]
    },
    {
      "@timestamp": "2019-07-07T07:58:02.000",
      "timestamp": "2019-07-07T07:58:02.000",
      "block_num": 2156575,
      "trx_id": "3d1b3d85039c0409064a725ce45d7156d86857a4b4cd72512464054583f45841",
      "act": {
        "account": "cheeseburger",
        "name": "create",
        "authorization": [
          {
            "actor": "cheeseburger",
            "permission": "active"
          }
        ],
        "data": {
          "issuer": "cheeseburger",
          "maximum_supply": "21000000.0000 CHEESE"
        }
      },
      "receipts": [
        {
          "receiver": "cheeseburger",
          "global_sequence": 2221460,
          "recv_sequence": 11,
          "auth_sequence": [
            {
              "account": "cheeseburger",
              "sequence": 33
            }
          ]
        }
      ],
      "cpu_usage_us": 221,
      "net_usage_words": 15,
      "account_ram_deltas": [
        {
          "account": "cheeseburger",
          "delta": 264
        }
      ],
      "global_sequence": 2221460,
      "producer": "producerg",
      "action_ordinal": 1,
      "creator_action_ordinal": 0,
      "signatures": [
        "SIG_K1_K5vZrK7mE2B9SQ25VQPijyuFuHMR7REivMoqM5AMwzz4rPsQH1rzvxZPUcgpNR8fAFEVqY2yxUNWhQbQYrJZf3kQRtgzkF"
      ]
    },
    {
      "@timestamp": "2019-07-12T16:16:03.000",
      "timestamp": "2019-07-12T16:16:03.000",
      "block_num": 3074673,
      "trx_id": "81b92d88a942d468ea5530e4fbc78d7cd151b33e1e5ccbc5de9385d540ebd863",
      "act": {
        "account": "openbrmdcart",
        "name": "create",
        "authorization": [
          {
            "actor": "openbrmdcart",
            "permission": "active"
          }
        ],
        "data": {
          "issuer": "openbrmdcart",
          "category": "ticket",
          "token_name": "ticketasset",
          "fungible": false,
          "burnable": true,
          "transferable": true,
          "base_uri": "dcart.io",
          "max_supply": "1000 DCART"
        }
      },
      "receipts": [
        {
          "receiver": "openbrmdcart",
          "global_sequence": 3244635,
          "recv_sequence": 2,
          "auth_sequence": [
            {
              "account": "openbrmdcart",
              "sequence": 4
            }
          ]
        }
      ],
      "cpu_usage_us": 561,
      "net_usage_words": 18,
      "account_ram_deltas": [
        {
          "account": "openbrmdcart",
          "delta": 540
        }
      ],
      "global_sequence": 3244635,
      "producer": "hyperblocks",
      "action_ordinal": 1,
      "creator_action_ordinal": 0,
      "signatures": [
        "SIG_K1_KAK9xsxVmWEnp4kdj9hZsePcpkbcqRzxwd5AZo76TFJTgeyaCn9oLWnkwNPG17Un4ihx1xqtk225bRhwPpbVqZqa3UTFCy"
      ]
    },
    {
      "@timestamp": "2019-07-13T11:59:28.000",
      "timestamp": "2019-07-13T11:59:28.000",
      "block_num": 3216683,
      "trx_id": "117f4148b45f1434088d23c392fa01d293f210081ef9079235dbd3a44f93f20c",
      "act": {
        "account": "waxnametoken",
        "name": "create",
        "authorization": [
          {
            "actor": "waxnametoken",
            "permission": "active"
          }
        ],
        "data": {
          "issuer": "waxnametoken",
          "maximum_supply": "1000000000.000000 NAME"
        }
      },
      "receipts": [
        {
          "receiver": "waxnametoken",
          "global_sequence": 3402578,
          "recv_sequence": 4,
          "auth_sequence": [
            {
              "account": "waxnametoken",
              "sequence": 10
            }
          ]
        }
      ],
      "cpu_usage_us": 198,
      "net_usage_words": 15,
      "account_ram_deltas": [
        {
          "account": "waxnametoken",
          "delta": 264
        }
      ],
      "global_sequence": 3402578,
      "producer": "producerj",
      "action_ordinal": 1,
      "creator_action_ordinal": 0,
      "signatures": [
        "SIG_K1_KXSn2EKjs4ZwfR3SEPGK2NZ1MmqXvBiNDYEM7jH6wTCsJeZYashS5DeAr3fZkyd7LZBxbBFptuCkSg1m8yz67C9ZDXRXdE"
      ]
    },
    {
      "@timestamp": "2019-07-18T17:56:00.500",
      "timestamp": "2019-07-18T17:56:00.500",
      "block_num": 4121715,
      "trx_id": "7af15ec627727fa0391e8aefaf2c9549cb944a0b684066e142179fa21854b0b6",
      "act": {
        "account": "nebulaccount",
        "name": "create",
        "authorization": [
          {
            "actor": "nebulablocks",
            "permission": "active"
          }
        ],
        "data": {
          "owner": "nebulablocks",
          "data": "QmaJUTkF9BLzAoV4FhDFxPpF7WLPZYEXtnZekr98wysmB4",
          "avatar": "QmTqF6NMCALa38AntLxWere3Bzuve5m3WapfhC1gY8YtdY"
        }
      },
      "receipts": [
        {
          "receiver": "nebulaccount",
          "global_sequence": 4522806,
          "recv_sequence": 1,
          "auth_sequence": [
            {
              "account": "nebulablocks",
              "sequence": 42
            }
          ]
        }
      ],
      "cpu_usage_us": 296,
      "net_usage_words": 25,
      "account_ram_deltas": [
        {
          "account": "nebulablocks",
          "delta": 326
        }
      ],
      "global_sequence": 4522806,
      "producer": "worker.wax",
      "action_ordinal": 1,
      "creator_action_ordinal": 0,
      "signatures": [
        "SIG_K1_K5mu1uTHwMERnmzGS7nVmansPKUa3GvihH6ghzBuVWpNjdiQVgZvVEGDbk1KK7DvMT2ETcojp11PAh8UrWWkQjBM4HER3A"
      ]
    }
  ]
}`;

export function CheeseHistorySection() {
  return (
    <section className="py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* About CHEESE Text */}
        <div className="space-y-4 text-foreground leading-relaxed">
          <h3 className="text-xl font-semibold text-primary text-center">History</h3>
          <p>
            We want to share a few details about the CHEESE Token on the WAX blockchain. CHEESE is a
            memecoin that was launched on the WAX blockchain on July 7, 2019 (Block 2156575) as a fun project.
          </p>
          <p>
            The maximum supply of CHEESE is 21,000,000 tokens. Why 21 million? This is a tribute to the total
            supply of the greatest (and only true) cryptocurrency, Bitcoin. The CHEESE token was created by
            the contract "cheeseburger."
          </p>
          <p>
            CHEESE represents the delightful enjoyment of cheese, which we firmly believe is an essential
            topping for every hamburger. CHEESE is flavor, CHEESE is joy. While there are hundreds of tokens
            on the WAX blockchain, CHEESE has a unique distinction: it is the <strong>first token</strong> created after the
            chain's native token, WAX, right after the WAX mainnet launch.
          </p>
          <p>
            In this early phase of WAX, there was no finalized NFT standard, no marketplaces, and no tokens
            other than WAX. CHEESE was airdropped shortly after its creation to several hundred of the first
            WAX addresses. Thus, CHEESE also holds the honor of being the first token airdrop on the WAX
            blockchain. CHEESE is not just any memecoin on WAX; it is a piece of blockchain history.
          </p>
        </div>

        {/* Verify the History */}
        <div className="space-y-4 text-foreground">
          <h3 className="text-xl font-semibold text-primary text-center">Verify the History</h3>
          <p className="text-center">
            To prove CHEESE was the first token created on WAX (besides WAX itself, which was deployed on
            June 24, 2019), use the following verification command:
          </p>

          {/* URL Box */}
          <Card className="bg-muted/50 border-border p-3">
            <code className="text-xs sm:text-sm text-foreground break-all">
              {VERIFICATION_URL}
            </code>
          </Card>

          <p className="text-center">
            The JSON output will provide the evidence.
          </p>

          {/* JSON Scroll Box */}
          <Card className="bg-muted/30 border-border">
            <ScrollArea className="h-48 w-full rounded-md">
              <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre">
                {HISTORY_JSON}
              </pre>
            </ScrollArea>
          </Card>

          {/* Verification Badge */}
          {IS_VERIFIED && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-green-500 font-medium">History Verified</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
