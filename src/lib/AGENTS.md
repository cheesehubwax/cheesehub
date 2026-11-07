# Connection rules

- Wallet RPC fallback belongs in SessionKit's shared fetch transport, inherited by login/restore; retry only allowlisted read requests, never restart transact or rebroadcast, so wallet prompts, signed bytes and Fuel semantics stay intact.
- Use centralized health-ordered endpoints and bounded whole-response timeouts for chain reads; remote monitor health does not establish browser reachability.