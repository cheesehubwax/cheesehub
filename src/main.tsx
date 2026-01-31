import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureTokenCacheLoaded } from "./lib/tokenLogos";

// Pre-load token contracts from Alcor API for logo resolution
ensureTokenCacheLoaded();

createRoot(document.getElementById("root")!).render(<App />);
