

## Add Alcor Swap Widget Sections to Disclaimer & Terms

### Disclaimer — New subsection 7.10 "CHEESESwap (Alcor Swap Widget)"

Insert after the 7.9 CHEESEWallet subsection (after line 140), as a new `<div>` block within the Platform Features section:

> **7.10 CHEESESwap (Alcor Swap Widget)**
>
> CHEESESwap provides an embedded interface for token swaps powered entirely by Alcor Exchange's smart contracts (including `swap.alcor`) deployed on the WAX blockchain. Alcor Exchange is a third-party decentralised exchange not affiliated with, owned by, or controlled by CHEESEHub or the CHEESE DAO. CHEESEHub does not custody, hold, pool, or have access to any user funds at any point during a swap. All swap transactions are constructed in the user's browser, signed by the user's own wallet provider, and executed directly against Alcor's on-chain smart contracts. CHEESEHub does not execute, intermediate, settle, match, or arrange any swap on behalf of any user. Swap routing, price calculations, and minimum received amounts are determined by Alcor's public API and on-chain pool liquidity — CHEESEHub merely displays this information for convenience. Price quotes, price impact estimates, and output amounts shown in the interface are indicative only and may differ from the final on-chain execution due to slippage, pool depth changes, or concurrent transactions. CHEESEHub makes no guarantee regarding swap execution, pricing accuracy, or availability of the Alcor API. Users are solely responsible for reviewing and confirming all transaction details before signing.

### Terms of Use — New bullet in Section 6 (User Responsibilities) + mention in Section 9

**Section 6** — Add a new `<li>` after the existing fee-routing bullet (line 60):

> You acknowledge that the CHEESESwap feature is solely a frontend interface to Alcor Exchange's smart contracts. CHEESEHub does not custody funds, execute swaps, or act as a counterparty. All swaps are direct on-chain interactions between you and the `swap.alcor` contract. You are responsible for reviewing swap details — including output amounts, price impact, and slippage — before signing any transaction.

**Section 9 (Third-Party Services)** — Append a sentence to the existing paragraph (line 87):

> The CHEESESwap widget embedded within CHEESEHub is a convenience interface to Alcor Exchange's swap routing and does not constitute the operation of an exchange, dealing service, or trading platform by CHEESEHub.

