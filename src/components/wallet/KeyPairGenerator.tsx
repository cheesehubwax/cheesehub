import { useState } from 'react';
import { PrivateKey } from '@wharfkit/session';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Key, Copy, Check, ChevronDown, AlertTriangle } from 'lucide-react';

interface KeyPairGeneratorProps {
  onUseAsOwnerKey: (publicKey: string) => void;
  onUseAsActiveKey: (publicKey: string) => void;
}

export function KeyPairGenerator({ onUseAsOwnerKey, onUseAsActiveKey }: KeyPairGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyPair, setKeyPair] = useState<{ privateKey: string; publicKey: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const generateKeyPair = () => {
    const privKey = PrivateKey.generate('K1');
    setKeyPair({ privateKey: privKey.toWif(), publicKey: privKey.toPublic().toString() });
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(text, field)}>
      {copiedField === field ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between border-primary/30 hover:border-primary/50 hover:bg-primary/5">
          <span className="flex items-center gap-2"><Key className="h-4 w-4 text-primary" />Key Pair Generator</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-200 [&>svg]:text-yellow-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">Save your private key securely. It will not be stored or shown again.</AlertDescription>
        </Alert>
        <Button type="button" onClick={generateKeyPair} className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30" variant="outline">
          <Key className="mr-2 h-4 w-4" />{keyPair ? 'Generate New Key Pair' : 'Generate Key Pair'}
        </Button>
        {keyPair && (
          <div className="space-y-3 rounded-lg border border-border/50 bg-card/50 p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-destructive">Private Key (WIF) — Keep Secret!</label>
              <div className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5">
                <code className="flex-1 break-all text-[11px] font-mono text-destructive/90">{keyPair.privateKey}</code>
                <CopyButton text={keyPair.privateKey} field="private" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Public Key</label>
              <div className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-1.5">
                <code className="flex-1 break-all text-[11px] font-mono text-foreground/80">{keyPair.publicKey}</code>
                <CopyButton text={keyPair.publicKey} field="public" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="flex-1 text-xs border-primary/30 hover:bg-primary/10" onClick={() => onUseAsOwnerKey(keyPair.publicKey)}>Use as Owner Key</Button>
              <Button type="button" size="sm" variant="outline" className="flex-1 text-xs border-primary/30 hover:bg-primary/10" onClick={() => onUseAsActiveKey(keyPair.publicKey)}>Use as Active Key</Button>
              <Button type="button" size="sm" className="w-full text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30" variant="outline"
                onClick={() => { onUseAsOwnerKey(keyPair.publicKey); onUseAsActiveKey(keyPair.publicKey); }}>Use for Both</Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
