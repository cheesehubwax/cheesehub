import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  FarmInfo, fetchFarmStakableConfig, FarmStakableConfig, RewardValue,
  buildSetTemplateValuesAction, buildSetSchemaValuesAction,
  buildSetCollectionValuesAction, buildSetAttributeValuesAction,
  buildEraseTemplateValuesAction, buildEraseSchemaValuesAction,
  buildEraseCollectionValuesAction, buildEraseAttributeValuesAction,
} from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";

interface ManageStakableAssetsProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ManageStakableAssets({ farm, open, onOpenChange, onSuccess }: ManageStakableAssetsProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [config, setConfig] = useState<FarmStakableConfig | null>(null);

  // Add form state
  const [newCollection, setNewCollection] = useState("");
  const [newSchema, setNewSchema] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");
  const [newRewardValues, setNewRewardValues] = useState<{ quantity: string; contract: string }[]>([]);

  useEffect(() => {
    if (open) {
      loadConfig();
      // Pre-fill reward value inputs based on farm's reward pools
      setNewRewardValues(
        farm.reward_pools.map(p => ({
          quantity: "",
          contract: p.contract,
        }))
      );
    }
  }, [open, farm.farm_name]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await fetchFarmStakableConfig(farm.farm_name);
      setConfig(cfg);
    } finally {
      setLoading(false);
    }
  };

  const farmType = farm.farm_type; // 0=col, 1=sch, 2=tmp, 3=att

  const buildRewardValues = (): RewardValue[] => {
    return newRewardValues
      .filter(rv => rv.quantity && parseFloat(rv.quantity) > 0)
      .map(rv => {
        const pool = farm.reward_pools.find(p => p.contract === rv.contract);
        const precision = pool?.precision || 4;
        const symbol = pool?.symbol || "";
        return {
          quantity: `${parseFloat(rv.quantity).toFixed(precision)} ${symbol}`,
          contract: rv.contract,
        };
      });
  };

  const handleAdd = async () => {
    if (!accountName) return;
    setTxLoading(true);
    try {
      const rewardValues = buildRewardValues();
      if (rewardValues.length === 0) {
        toast({ title: "Error", description: "Enter reward values", variant: "destructive" });
        return;
      }

      let action: any;
      if (farmType === 0) {
        if (!newCollection) return;
        action = buildSetCollectionValuesAction(accountName, farm.farm_name, newCollection, rewardValues);
      } else if (farmType === 1) {
        if (!newCollection || !newSchema) return;
        action = buildSetSchemaValuesAction(accountName, farm.farm_name, newCollection, newSchema, rewardValues);
      } else if (farmType === 2) {
        if (!newCollection || !newTemplateId) return;
        action = buildSetTemplateValuesAction(accountName, farm.farm_name, newCollection, parseInt(newTemplateId), rewardValues);
      } else {
        if (!newAttrName || !newAttrValue) return;
        action = buildSetAttributeValuesAction(accountName, farm.farm_name, newAttrName, newAttrValue, rewardValues);
      }

      const result = await executeTransaction([action], {
        successTitle: "Stakable Asset Added!",
      });
      if (result.success) {
        await loadConfig();
        setNewCollection("");
        setNewSchema("");
        setNewTemplateId("");
        setNewAttrName("");
        setNewAttrValue("");
        setNewRewardValues(farm.reward_pools.map(p => ({ quantity: "", contract: p.contract })));
        onSuccess();
      }
    } finally {
      setTxLoading(false);
    }
  };

  const handleErase = async (type: string, params: any) => {
    if (!accountName) return;
    setTxLoading(true);
    try {
      let action: any;
      if (type === "template") {
        action = buildEraseTemplateValuesAction(accountName, farm.farm_name, params.templateId);
      } else if (type === "schema") {
        action = buildEraseSchemaValuesAction(accountName, farm.farm_name, params.collection, params.schema);
      } else if (type === "collection") {
        action = buildEraseCollectionValuesAction(accountName, farm.farm_name, params.collection);
      } else {
        action = buildEraseAttributeValuesAction(accountName, farm.farm_name, params.attrName, params.attrValue);
      }

      const result = await executeTransaction([action], {
        successTitle: "Stakable Asset Removed!",
      });
      if (result.success) {
        await loadConfig();
        onSuccess();
      }
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Stakable Assets</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current config */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Current Configuration</h4>
              {config && (
                <>
                  {config.collections.map((c, i) => (
                    <Card key={`col-${i}`} className="bg-card/60">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-2">Collection</Badge>
                          <span className="text-sm font-mono">{c.collection}</span>
                          <span className="text-xs text-muted-foreground ml-2">{c.hourly_rate}/hr</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleErase("collection", { collection: c.collection })} disabled={txLoading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {config.schemas.map((s, i) => (
                    <Card key={`sch-${i}`} className="bg-card/60">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-2">Schema</Badge>
                          <span className="text-sm font-mono">{s.collection}:{s.schema}</span>
                          <span className="text-xs text-muted-foreground ml-2">{s.hourly_rate}/hr</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleErase("schema", { collection: s.collection, schema: s.schema })} disabled={txLoading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {config.templates.map((t, i) => (
                    <Card key={`tmp-${i}`} className="bg-card/60">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-2">Template</Badge>
                          <span className="text-sm font-mono">{t.collection}:#{t.template_id}</span>
                          <span className="text-xs text-muted-foreground ml-2">{t.hourly_rate}/hr</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleErase("template", { templateId: t.template_id })} disabled={txLoading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {config.attributes.map((a, i) => (
                    <Card key={`att-${i}`} className="bg-card/60">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-2">Attribute</Badge>
                          <span className="text-sm font-mono">{a.attribute_name}={a.attribute_value}</span>
                          <span className="text-xs text-muted-foreground ml-2">{a.hourly_rate}/hr</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleErase("attribute", { attrName: a.attribute_name, attrValue: a.attribute_value })} disabled={txLoading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {!config.collections.length && !config.schemas.length && !config.templates.length && !config.attributes.length && (
                    <p className="text-sm text-muted-foreground">No stakable assets configured yet</p>
                  )}
                </>
              )}
            </div>

            {/* Add new */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Stakable Asset
              </h4>

              {(farmType === 0 || farmType === 1 || farmType === 2) && (
                <div>
                  <Label className="text-xs">Collection Name</Label>
                  <Input value={newCollection} onChange={(e) => setNewCollection(e.target.value)} placeholder="mycollection" />
                </div>
              )}

              {farmType === 1 && (
                <div>
                  <Label className="text-xs">Schema Name</Label>
                  <Input value={newSchema} onChange={(e) => setNewSchema(e.target.value)} placeholder="myschema" />
                </div>
              )}

              {farmType === 2 && (
                <div>
                  <Label className="text-xs">Template ID</Label>
                  <Input value={newTemplateId} onChange={(e) => setNewTemplateId(e.target.value)} placeholder="12345" type="number" />
                </div>
              )}

              {farmType === 3 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Attribute Name</Label>
                    <Input value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} placeholder="rarity" />
                  </div>
                  <div>
                    <Label className="text-xs">Attribute Value</Label>
                    <Input value={newAttrValue} onChange={(e) => setNewAttrValue(e.target.value)} placeholder="legendary" />
                  </div>
                </div>
              )}

              {/* Reward values per pool */}
              <div className="space-y-2">
                <Label className="text-xs">Hourly Reward per NFT</Label>
                {newRewardValues.map((rv, i) => {
                  const pool = farm.reward_pools.find(p => p.contract === rv.contract);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">{pool?.symbol || rv.contract}</span>
                      <Input
                        type="number"
                        value={rv.quantity}
                        onChange={(e) => {
                          const updated = [...newRewardValues];
                          updated[i] = { ...updated[i], quantity: e.target.value };
                          setNewRewardValues(updated);
                        }}
                        placeholder="0.0000"
                        step="0.0001"
                      />
                    </div>
                  );
                })}
              </div>

              <Button onClick={handleAdd} disabled={txLoading} className="w-full bg-primary text-primary-foreground">
                {txLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Stakable Asset
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
