# Crypt components

- Tips: `/tip` reply adds a direct sender→author CHEESE transfer (fixed memo) to the message transaction, never routed or held by crypt.cheese; tip cards show verified only when that tx has the matching sender-authorized transfer, so cards can't be faked.
- Free sends: build `sendfree` only from an exact [payment, sendmsg] route when a live enabled `budget` row covers the fee; voice/join pass `paid`. History merges `crypt.cheese:sendfree` actions attributed only to the authorizing sender.
