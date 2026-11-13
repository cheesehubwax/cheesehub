import { useEffect, useRef, useState } from "react";
import { ALCOR_WIDGET_ORIGIN, widgetUrl } from "@/lib/alcorBridge";

/** Alcor's official inline widget. Only Alcor's origin may resize it. */
export function BridgeWidget({ recipient }: { recipient: string | null }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== ALCOR_WIDGET_ORIGIN || e.source !== ref.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string; data?: { height?: number } };
      if (d?.source !== "alcor-bridge" || d.type !== "resize") return;
      const h = Number(d.data?.height);
      if (Number.isFinite(h) && h > 200 && h < 3000) setHeight(Math.ceil(h));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <div className="space-y-2">
      <iframe
        ref={ref}
        key={recipient ?? "none"}
        src={widgetUrl({ recipient })}
        title="Alcor bridge"
        style={{ height }}
        className="w-full max-w-[480px] mx-auto block rounded-lg border border-border bg-card"
        allow="clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p className="text-xs text-center text-muted-foreground">
        Widget not loading?{" "}
        <a href={widgetUrl({ recipient }).replace("/embed/bridge", "/v/wax/bridge")} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
          Open the bridge on Alcor
        </a>
      </p>
    </div>
  );
}
