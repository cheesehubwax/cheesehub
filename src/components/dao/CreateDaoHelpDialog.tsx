import type { RefObject } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger as AccordionTriggerUI } from "@/components/ui/accordion";

interface CreateDaoHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accordionValue: string[];
  onAccordionValueChange: (value: string[]) => void;
  anchorRef: RefObject<HTMLDivElement>;
}

/** "Click me for help" guide for DAO creation. Presentational; CreateDao owns its state. */
export function CreateDaoHelpDialog({ open, onOpenChange, accordionValue, onAccordionValueChange, anchorRef }: CreateDaoHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs text-primary hover:underline ml-2">click me for help</button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>DAO Creation Guide</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <Accordion type="multiple" value={accordionValue} onValueChange={onAccordionValueChange} className="w-full">
            <AccordionItem value="cheese-payment">
              <AccordionTriggerUI className="text-primary">Paying with CHEESE Tokens</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground space-y-2">
               <p><strong>CHEESE is the standard payment method</strong> and gives you a <strong>20% discount</strong> on the 265 WAX creation fee.</p>
                <p>Simply select the CHEESE payment option (selected by default) and the transaction will handle everything automatically in a single step - no prepayment required!</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="dao-name">
              <AccordionTriggerUI className="text-primary">DAO Name Format</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground space-y-2">
                <p>Your DAO name must follow the WAX account name format:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Maximum 12 characters</li>
                  <li>Only lowercase letters <code className="bg-muted px-1 rounded">a-z</code></li>
                  <li>Numbers <code className="bg-muted px-1 rounded">1-5</code> only (no 0, 6, 7, 8, 9)</li>
                  <li>Periods <code className="bg-muted px-1 rounded">.</code> are allowed</li>
                  <li>No capitals, spaces, or special characters</li>
                </ul>
                <p>Example: <code className="bg-muted px-1 rounded">cheesedao</code>, <code className="bg-muted px-1 rounded">my.dao.123</code></p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="dao-types">
              <AccordionTriggerUI className="text-primary">DAO Types Explained</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground space-y-3">
                <p>CHEESEDao supports 2 DAO types:</p>
                <div>
                  <p className="font-semibold text-primary">Stake Tokens (Custodial)</p>
                  <p>Members stake governance tokens directly to the DAO. <strong>No external farm needed.</strong> Tokens are held by the DAO contract until unstaked. Voting power equals staked balance.</p>
                </div>
                <div>
                  <p className="font-semibold text-primary">Hold NFTs (Non-Custodial)</p>
                  <p><strong>No staking required!</strong> NFTs stay in user's wallet. Simply hold eligible NFTs to vote. Each NFT = 1 vote. Best for NFT communities.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="settings">
              <AccordionTriggerUI className="text-primary">Configuration Settings</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground space-y-3">
                <div>
                  <p className="font-semibold text-primary">Threshold</p>
                  <p>The percentage of "Yes" votes required for a proposal to pass. A 51% threshold means a simple majority is needed. Higher thresholds require broader consensus but can make it harder to pass proposals.</p>
                </div>
                <div>
                  <p className="font-semibold text-primary">Minimum Votes</p>
                  <p>The minimum total vote weight needed for a proposal to be valid. Vote weight is counted in tokens staked (or NFTs held), <strong>not in number of members</strong>, so one large holder can outweigh many small ones. Every proposal needs at least 1 whole token (or NFT) of total votes cast. If the total is lower, the proposal ends as "Quorum Not Met" and nothing is sent from the treasury, even if every vote was Yes. For example, two members voting with 0.1 WAX staked each adds up to only 0.2 WAX, which is not enough.</p>
                </div>
                <div>
                  <p className="font-semibold text-primary">Voting Duration</p>
                  <p>How long voting stays open for each proposal. Common durations are 24 hours (quick decisions), 72 hours (standard), or 168 hours (1 week for major decisions).</p>
                </div>
                <div>
                  <p className="font-semibold text-primary">Proposer Types</p>
                  <p>Control who can create proposals in your DAO:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong>Anyone</strong> — Any WAX wallet can create proposals. Most democratic but may require proposal fees to prevent spam.</li>
                    <li><strong>Authors Only</strong> — Only wallets you specifically authorize can create proposals. Good for curated governance with trusted community members.</li>
                    <li><strong>Token Balance</strong> — Users must hold a minimum token balance in their wallet to create proposals. Ensures proposers have skin in the game.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-primary">Proposal Cost</p>
                  <p>An optional WAX fee required to submit a proposal. This fee goes directly to your DAO's treasury and serves two purposes:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Prevents spam proposals</li>
                    <li>Generates treasury revenue</li>
                  </ul>
                  <p>Set to 0 for free proposals. Common values range from 1-100 WAX depending on how exclusive you want proposal creation to be.</p>
                </div>
                <div>
                  <p className="font-semibold text-primary">Treasury & Deposits</p>
                  <p>After creating your DAO, you can deposit WAX, tokens, and NFTs to the treasury. These assets can then be distributed through governance proposals.</p>
                  <p>Treasury deposits are managed separately from the creation process. Visit your DAO's detail page after creation to make deposits.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ipfs">
              <AccordionTriggerUI className="text-primary">IPFS Hash (Avatar & Cover Image)</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground space-y-2">
                <p>These are your DAO's logos - the <strong>cover image</strong> is a large background pic, and the <strong>avatar</strong> should be a small (e.g. 300 x 300) pic.</p>
                <p>Both should be <strong>IPFS hash only</strong>, do NOT put the full URL.</p>
                <p>Example hash: <code className="bg-muted px-1 rounded">QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco</code></p>
                <p>Supported formats: <code className="bg-muted px-1 rounded">jpeg</code> and <code className="bg-muted px-1 rounded">png</code></p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="modify">
              <AccordionTriggerUI className="text-primary">Modifying Settings Later</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground">
                <p>Once created, DAO settings <strong>cannot be changed</strong>. Please review all configuration options carefully before submitting. Choose wisely!</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="anchor" ref={anchorRef}>
              <AccordionTriggerUI className="text-primary">Why does Anchor show a "Dangerous Transaction" warning?</AccordionTriggerUI>
              <AccordionContent className="text-sm text-foreground space-y-2">
                <p>This transaction includes <strong>inline actions</strong> from the <code className="bg-muted px-1 rounded">cheesefeefee</code> smart contract — it sends WAXDAO tokens to your wallet and burns fees automatically. These are standard, safe operations and the contract is open source.</p>
                <p>To proceed in Anchor Wallet:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Tap the gear/settings icon</li>
                  <li>Toggle <strong>"Allow Dangerous Transactions"</strong> ON</li>
                  <li>Sign the transaction</li>
                  <li>Optionally toggle it back OFF afterward</li>
                </ol>
                <p>Some versions of Anchor also show an <strong>"Allow for this transaction only"</strong> checkbox — you can use that instead.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
