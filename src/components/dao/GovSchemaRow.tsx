import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { fetchTableRows } from "@/lib/waxRpcFallback";

export type GovSchemaCheck = "idle" | "checking" | "ok" | "no_collection" | "no_schema" | "not_authorized";

interface AaCollectionRow {
  collection_name: string;
  author: string;
  authorized_accounts: string[];
}

interface AaSchemaRow {
  schema_name: string;
}

interface Props {
  collection: string;
  schema: string;
  creator: string; // wallet creating the DAO
  onChange: (field: "collection_name" | "schema_name", value: string) => void;
  onRemove?: () => void;
  onStatusChange?: (status: GovSchemaCheck) => void;
}

export function GovSchemaRow({ collection, schema, creator, onChange, onRemove, onStatusChange }: Props) {
  const [status, setStatus] = useState<GovSchemaCheck>("idle");

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    const col = collection.trim().toLowerCase();
    const sch = schema.trim().toLowerCase();
    if (!col || !sch || !creator) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        // 1. Collection exists + creator is authorized
        const colRows = await fetchTableRows<AaCollectionRow>({
          code: "atomicassets",
          scope: "atomicassets",
          table: "collections",
          lower_bound: col,
          upper_bound: col,
          limit: 1,
        });
        if (cancelled) return;
        const colRow = colRows.rows[0];
        if (!colRow) { setStatus("no_collection"); return; }
        const authorized =
          colRow.author === creator ||
          (Array.isArray(colRow.authorized_accounts) && colRow.authorized_accounts.includes(creator));
        if (!authorized) { setStatus("not_authorized"); return; }

        // 2. Schema exists in collection
        const schRows = await fetchTableRows<AaSchemaRow>({
          code: "atomicassets",
          scope: col,
          table: "schemas",
          lower_bound: sch,
          upper_bound: sch,
          limit: 1,
        });
        if (cancelled) return;
        if (!schRows.rows[0]) { setStatus("no_schema"); return; }
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(id); };
  }, [collection, schema, creator]);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          placeholder="Collection name"
          value={collection}
          onChange={e => onChange("collection_name", e.target.value.toLowerCase().replace(/[^a-z1-5.]/g, "").slice(0, 12))}
        />
        <Input
          placeholder="Schema name"
          value={schema}
          onChange={e => onChange("schema_name", e.target.value.toLowerCase().replace(/[^a-z1-5.]/g, "").slice(0, 12))}
        />
        {onRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove} type="button">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
      {status !== "idle" && (
        <div className="flex items-center gap-1.5 text-xs pl-1">
          {status === "checking" && (
            <><Loader2 className="h-3 w-3 animate-spin" /> <span className="text-muted-foreground">Verifying collection on-chain…</span></>
          )}
          {status === "ok" && (
            <><Check className="h-3 w-3 text-green-500" /> <span className="text-green-500">Collection found and you are authorized</span></>
          )}
          {status === "no_collection" && (
            <><AlertCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">Collection "{collection}" does not exist on AtomicAssets</span></>
          )}
          {status === "no_schema" && (
            <><AlertCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">Schema "{schema}" not found in collection "{collection}"</span></>
          )}
          {status === "not_authorized" && (
            <><AlertCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">
              You ({creator}) are not authorized on collection "{collection}". Ask the collection owner to add you via <code className="bg-muted px-1 rounded">addcolauth</code>.
            </span></>
          )}
        </div>
      )}
    </div>
  );
}
