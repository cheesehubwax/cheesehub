# Make the farm tutorial reliably visible

## Goal
The farm creation page must never show an unexplained blank grey video area.

## Plan
1. Replace the bare YouTube frame with a small tutorial-player component that has explicit loading, ready, and unavailable states.
2. Load the YouTube player through its supported player API and only reveal it after YouTube confirms the player is ready.
3. Keep a local page-owned poster layer visible while loading. If YouTube does not become ready or returns an error, show the tutorial title and a clear **Watch on YouTube** play button instead of a blank square.
4. Preserve the existing tutorial link and confirmation requirement.
5. Verify the actual signed-in Create Farm tab in the browser at desktop size, including the failure fallback, and only report success after screenshot evidence confirms visible content.

## Technical details
- The current page uses a plain cross-origin iframe. The supplied screenshot confirms its area remains blank, and the latest captured page requests contain no YouTube player request, so an iframe `src` change alone is not a sufficient fix.
- Player readiness will be time-bounded; failure cannot leave the empty frame covering the fallback.
- Add focused tests for the initial loading state, successful readiness, timeout, and YouTube error fallback.
