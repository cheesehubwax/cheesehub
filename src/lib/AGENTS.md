# Connection rules

- Crypt history shape validation precedes merge/decode and unread/profile derivation; skip invalid rows without mutating surviving identities or relaxing authenticated control parsing, so malformed legacy history cannot poison the conversation.
- Render diagnostics use cryptDiagnostics for allowlisted messages and source-only stacks, never raw exceptions, because exception strings can contain decrypted content.

- Nightcrawler setup exports only verified isolated sendfree keys from mounted form state; never replace existing permission/links or overwrite local files. Static bundles mirror the standalone runner; the website never starts or stops its local process.

- Wallet RPC fallback belongs in SessionKit's shared fetch transport, inherited by login/restore; retry only allowlisted read requests, never restart transact or rebroadcast, so wallet prompts, signed bytes and Fuel semantics stay intact. On /crypt, an exclusive loopback Tor helper is the sole signed-broadcast transport: preserve exact bytes, make one attempt and never fall back directly.
- Use centralized health-ordered endpoints and bounded whole-response timeouts for chain reads; remote monitor health does not establish browser reachability.
- Homepage AMM TVL values contract-qualified reserves using live WAXUSDC-bridged prices, never raw Alcor TVL or doubled one-sided amounts; bounded complete table reads and partial flags prevent silent undercounts. Spot/Nefty estimates stay separate.
- Crypt custom history reads use one whole-response deadline covering the Tor helper's bounded upstream retries; testing and actual history must share this transport so slow Tor connections do not falsely appear empty.
- Crypt restart history stores only field-whitelisted ciphertext in account/privacy-mode IndexedDB snapshots after unlock; rows and complete-only cursors commit atomically behind a five-minute reversible overlap. Restart deltas include legacy traffic in Standard, but Maximum and live polls remain account-blind; retain authenticated controls and rederive all decrypted state.
- Crypt owner recovery requires authenticated outgoing invites/admissions, never a listing-only roster; carried request keys are hints scoped to room controls. Folder group backups are account/key-bound authenticated ciphertext, retain encrypted controls and local decisions, merge without replacing held keys, and read before serialized staged writes to prevent reset overwrite.
- Crypt member recovery searches the existing bounded history when listings accompany an empty roster or a missing requested room; complete each depth before advancing and retain Maximum's account-blind transport, because listings are discovery hints, not membership authority.
- Crypt founder rosters only grow: owner `founder` controls and superset relists add non-banned members (capped at MAX_FOUNDERS for fixed-size room controls); nothing removes a founder.
- Crypt: getTransactPlugins returns no Greymass Fuel on /crypt and Instant sends use none; Fuel preflight leaks account/actions/IP.
- Crypt account-named chain reads use cryptChainRead (helper v1.4+, public without/older helper, fail closed when down); wallet prep reads on /crypt go only to a v1.6 helper, never mixed with broadcast retries.

- Crypt YouTube title and thumbnail lookups use capability-gated local helper routing; a saved old/down helper blocks them, and fixed video-ID paths with bounded JSON/raster responses prevent a general-purpose proxy. Playback remains separate with explicit Google consent.
