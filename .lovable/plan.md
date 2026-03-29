
## Fix CHEESEUp CPU failures even when Greymass Fuel is present

### What I found
- `PowerUpCard.tsx` already sends CHEESEUp through WharfKit with `getTransactPlugins(session)`.
- `wharfKit.ts` already enables `TransactPluginResourceProvider` for Anchor sessions, so your Anchor wallet is correctly attempting Fuel.
- The WharfKit/Fuel docs explicitly say the resource-provider flow is not a guarantee; if the provider rejects or cannot cover the transaction, the SDK proceeds and the transaction can still hit normal CPU billing.
- Your current app treats any CPU-related error as “Fuel unavailable or at daily limit,” which is too generic and hides the real reason.
- Separate network logs also show direct requests to `https://wax.greymass.com` failing in the preview, which suggests Greymass endpoint availability/reachability is already an issue elsewhere in the app.

### Conclusion
The bug is not “Fuel isn’t being used.”  
The real problem is: CHEESEUp assumes Fuel means guaranteed sponsorship, but Fuel is only a best-effort resource provider. If Fuel declines, is unreachable, quota-limited, or the transaction shape is not accepted, Anchor will still try to submit and the chain can bill the user CPU.

### Plan
1. Inspect the exact `session.transact` result/error shape for CHEESEUp and preserve more detail from WharfKit/Fuel instead of collapsing everything into a generic CPU toast.
2. Update `PowerUpCard.tsx` error handling to distinguish:
   - Fuel/resource-provider rejection
   - endpoint/network failure
   - on-chain CPU billing failure after fallback
   - signed-but-not-broadcast case
3. Change the CHEESEUp UI copy so it no longer claims the transaction should always succeed with no CPU. It should say sponsorship is attempted via Fuel, but may fail if Fuel is unavailable or rejects the transaction.
4. Add targeted debug logging around:
   - detected wallet type
   - transact plugins used
   - full error payload / nested cause
   - resolved transaction id presence
   This will make future failures diagnosable instead of looking random.
5. Review `getTransactPlugins` and `PowerUpCard` together to ensure the plugin is consistently attached and that no local cleanup logic is interfering with the wallet flow.
6. Optionally add a fallback preflight/status check for the Greymass resource provider endpoint so CHEESEUp can warn users before they sign when Fuel is clearly unreachable.

### Files to update
- `src/components/powerup/PowerUpCard.tsx`
- `src/lib/wharfKit.ts`

### Technical details
- Keep the tx-id verification already added; that part is correct.
- Replace the current broad CPU matcher in `PowerUpCard.tsx` with more specific parsing of nested WharfKit/Fuel errors.
- If the error indicates provider rejection or endpoint failure, show a sponsorship-specific message.
- If the error indicates actual on-chain billing, show that Fuel was attempted but the chain still billed CPU.
- Consider centralizing transaction error parsing in `wharfKit.ts` so other transaction flows can reuse it later.

### Expected outcome
After this change, CHEESEUp will stop behaving like “free powerup always works” and instead accurately report what happened:
- sponsored and confirmed,
- signed but not broadcast,
- provider unreachable/rejected,
- or chain billed CPU anyway.
