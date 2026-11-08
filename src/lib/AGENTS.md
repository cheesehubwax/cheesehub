# Connection rules

- Wallet RPC fallback belongs in SessionKit's shared fetch transport, inherited by login/restore; retry only allowlisted read requests, never restart transact or rebroadcast, so wallet prompts, signed bytes and Fuel semantics stay intact.
- Use centralized health-ordered endpoints and bounded whole-response timeouts for chain reads; remote monitor health does not establish browser reachability.
- Homepage AMM TVL values contract-qualified reserves using live WAXUSDC-bridged prices, never raw Alcor TVL or doubled one-sided amounts; bounded complete table reads and partial flags prevent silent undercounts. Spot/Nefty estimates stay separate.
- Crypt custom history reads use one whole-response deadline covering the Tor helper's bounded upstream retries; testing and actual history must share this transport so slow Tor connections do not falsely appear empty.