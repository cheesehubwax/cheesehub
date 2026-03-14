import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { DaoInfo, buildSetProfileActionWithSocials, DaoSocials } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface EditDaoProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dao: DaoInfo;
  onUpdated: () => void;
}

export function EditDaoProfile({ open, onOpenChange, dao, onUpdated }: EditDaoProfileProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState(dao.description || "");
  const [avatar, setAvatar] = useState(dao.logo || "");
  const [coverImage, setCoverImage] = useState(dao.cover_image || "");
  const [socials, setSocials] = useState<DaoSocials>(dao.socials || {});

  const updateSocial = (key: keyof DaoSocials, value: string) => {
    setSocials(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!session || !accountName) return;
    setLoading(true);

    const action = buildSetProfileActionWithSocials(
      accountName, dao.dao_name, description, avatar, coverImage, socials
    );
    const result = await executeTransaction([action], {
      successTitle: "Profile Updated! 🧀",
      successDescription: `${dao.dao_name} profile has been updated`,
    });

    if (result.success) {
      onUpdated();
      onOpenChange(false);
    }
    setLoading(false);
  };

  const socialFields: { key: keyof DaoSocials; label: string; placeholder: string }[] = [
    { key: "twitter", label: "Twitter", placeholder: "https://twitter.com/..." },
    { key: "discord", label: "Discord", placeholder: "https://discord.gg/..." },
    { key: "telegram", label: "Telegram", placeholder: "https://t.me/..." },
    { key: "website", label: "Website", placeholder: "https://..." },
    { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/..." },
    { key: "medium", label: "Medium", placeholder: "https://medium.com/..." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit DAO Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="DAO description..." />
          </div>
          <div>
            <Label>Avatar (IPFS hash or URL)</Label>
            <Input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="QmHash... or https://..." />
          </div>
          <div>
            <Label>Cover Image (IPFS hash or URL)</Label>
            <Input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="QmHash... or https://..." />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Social Links</Label>
            {socialFields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={socials[key] || ""}
                  onChange={e => updateSocial(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
