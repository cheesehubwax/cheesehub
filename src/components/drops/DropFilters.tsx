import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { NFTDrop } from "@/types/drop";

interface DropFiltersProps {
  drops: NFTDrop[];
  selectedCollection: string;
  selectedSchema: string;
  onCollectionChange: (value: string) => void;
  onSchemaChange: (value: string) => void;
  onClear: () => void;
}

export function DropFilters({
  drops,
  selectedCollection,
  selectedSchema,
  onCollectionChange,
  onSchemaChange,
  onClear,
}: DropFiltersProps) {
  const collections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const drop of drops) {
      counts.set(drop.collectionName, (counts.get(drop.collectionName) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [drops]);

  const schemas = useMemo(() => {
    if (!selectedCollection) return [];
    const counts = new Map<string, number>();
    for (const drop of drops) {
      if (drop.collectionName === selectedCollection && drop.schemaName) {
        counts.set(drop.schemaName, (counts.get(drop.schemaName) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [drops, selectedCollection]);

  const hasFilters = selectedCollection !== "" || selectedSchema !== "";

  if (collections.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <Select value={selectedCollection || "__all__"} onValueChange={(v) => onCollectionChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="w-[220px] bg-card/50 border-border/50">
          <SelectValue placeholder="All Collections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Collections ({drops.length})</SelectItem>
          {collections.map((c) => (
            <SelectItem key={c.name} value={c.name}>
              {c.name} ({c.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedCollection && schemas.length > 0 && (
        <Select value={selectedSchema || "__all__"} onValueChange={(v) => onSchemaChange(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[200px] bg-card/50 border-border/50">
            <SelectValue placeholder="All Schemas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Schemas</SelectItem>
            {schemas.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name} ({s.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
