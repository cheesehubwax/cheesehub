/** Signing window given to the never-broadcast key-lock request. */
export const LOCK_SIGN_WINDOW_MS = 3 * 60 * 1000;

/** Only requests that expired more than a day ago are treated as key-lock requests. */
const LONG_EXPIRED_MS = 86_400_000;

/**
 * The key-lock transaction carries a fixed expiration in the past (2020) so it can never be
 * broadcast. Anchor's plugin derives its prompt timeout and link expiry from that date, which
 * cancels the prompt instantly ("The request expired"). For such requests only, give the prompt
 * and the link a normal window. The transaction being signed (including its 2020 expiry) is untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function patchAnchorForLockSigning(plugin: any) {
  if (plugin.__lockSigningPatched) return plugin;
  const original = plugin.sign.bind(plugin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugin.sign = async (resolved: any, context: any) => {
    const expiration = resolved?.transaction?.expiration?.toDate?.() as Date | undefined;
    if (!expiration || expiration.getTime() > Date.now() - LONG_EXPIRED_MS) return original(resolved, context);

    const deadline = new Date(Date.now() + LOCK_SIGN_WINDOW_MS);
    const createRequest = context.createRequest.bind(context);
    const ctx = Object.create(context);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.createRequest = async (args: any) => {
      const req = await createRequest(args);
      const setInfoKey = req.setInfoKey.bind(req);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req.setInfoKey = (key: string, value: any, ...rest: any[]) => {
        if (key === 'link' && value?.constructor?.from) value = value.constructor.from({ expiration: deadline });
        return setInfoKey(key, value, ...rest);
      };
      return req;
    };

    const realSetTimeout = globalThis.setTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).setTimeout = (fn: any, delay?: number, ...args: any[]) =>
      realSetTimeout(fn, typeof delay === 'number' && delay < -LONG_EXPIRED_MS ? LOCK_SIGN_WINDOW_MS : delay, ...args);
    try {
      return await original(resolved, ctx);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  };
  plugin.__lockSigningPatched = true;
  return plugin;
}
