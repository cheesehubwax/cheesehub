import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2 } from "lucide-react";
import { FarmInfo, buildSetFarmProfileAction } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface EditFarmProfileProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditFarmProfile({ farm, open, onOpenChange, onSuccess }: EditFarmProfileProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [socialsOpen, setSocialsOpen] = useState(false);

  const [avatar, setAvatar] = useState(farm.profile?.avatar || "");
  const [coverImage, setCoverImage] = useState(farm.profile?.cover_image || "");
  const [description, setDescription] = useState(farm.description || "");
  const [socials, setSocials] = useState({
    twitter: farm.socials?.twitter || "",
    discord: farm.socials?.discord || "",
    telegram: farm.socials?.telegram || "",
    website: farm.socials?.website || "",
    youtube: farm.socials?.youtube || "",
    medium: farm.socials?.medium || "",
    atomichub: farm.socials?.atomichub || "",
    waxdao: farm.socials?.waxdao || "",
  });

  useEffect(() => {
    if (open) {
      setAvatar(farm.profile?.avatar || "");
      setCoverImage(farm.profile?.cover_image || "");
      setDescription(farm.description || "");
      setSocials({
        twitter: farm.socials?.twitter || "",
        discord: farm.socials?.discord || "",
        telegram: farm.socials?.telegram || "",
        website: farm.socials?.website || "",
        youtube: farm.socials?.youtube || "",
        medium: farm.socials?.medium || "",
        atomichub: farm.socials?.atomichub || "",
        waxdao: farm.socials?.waxdao || "",
      });
    }
  }, [open, farm]);

  const handleSave = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const action = buildSetFarmProfileAction(
        accountName,
        farm.farm_name,
        { avatar, cover_image: coverImage, description },
        socials
      );
      const result = await executeTransaction([action], {
        successTitle: "Profile Updated!",
        successDescription: "Farm profile has been updated",
      });
      if (result.success) {
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Farm Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Avatar (IPFS hash)</Label>
            <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="Qm..." />
          </div>
          <div>
            <Label>Cover Image (IPFS hash)</Label>
            <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="Qm..." />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Collapsible open={socialsOpen} onOpenChange={setSocialsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between" size="sm">
                Social Links
                <ChevronDown className={`h-4 w-4 transition-transform ${socialsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {(["twitter", "discord", "telegram", "website", "youtube", "medium"] as const).map(key => (
                <div key={key}>
                  <Label className="capitalize text-xs">{key}</Label>
                  <Input
                    value={socials[key]}
                    onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
                    placeholder={`https://${key}.com/...`}
                  />
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
