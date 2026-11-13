import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { openAlcorBridge } from "./AlcorBridgeDialog";

/** Old /bridge links go home and open the ALCORBridge modal. */
export function BridgeRedirect() {
  // No cleanup: the redirect unmounts this component, and cancelling the
  // timer here would swallow the open event before the home page mounts.
  useEffect(() => { setTimeout(openAlcorBridge, 300); }, []);
  return <Navigate to="/" replace />;
}
