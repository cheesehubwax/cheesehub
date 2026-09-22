import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { primeEndpointHealth } from "./lib/endpointHealth";

// Warm the node-health list once so the first reads already skip dead nodes.
primeEndpointHealth();

createRoot(document.getElementById("root")!).render(<App />);
