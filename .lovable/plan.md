# Preserve the automatic CHEESESwap comparison

## Changes
- Save the completed automatic quote when Manual mode is opened.
- Keep that automatic expected output visible beside the current manual expected output while allocations are adjusted.
- Show the difference between Manual and Auto in token amount and percentage, updating only the Manual side during recalculation.
- Clear the saved comparison when the amount, token pair, direction, or slippage changes so unlike quotes are never compared.
- Keep the saved automatic quote display-only; transaction execution continues to use the current manual quote.

## Verification
- Confirm Auto remains visible after switching to Manual and adjusting pool percentages.
- Confirm comparisons reset when quote inputs change.
- Run routing tests and verify the preview build.
