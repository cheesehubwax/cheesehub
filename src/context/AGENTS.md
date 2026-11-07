# Shared context rules

- Keep the WAX context object in a separate non-component module so provider and consumer identities remain aligned across Fast Refresh; missing providers must still throw rather than masquerade as a signed-out wallet.