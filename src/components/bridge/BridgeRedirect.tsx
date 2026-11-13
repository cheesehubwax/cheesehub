import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { openAlcorBridge } from "./AlcorBridgeDialog";

/** Old /bridge links go home and open the ALCORBridge modal. */
export function BridgeRedirect() {
  useEffect(() => { const t = setTimeout(openAlcorBridge, 300); return () => clearTimeout(t); }, []);
  return <Navigate to="/" replace />;
}
