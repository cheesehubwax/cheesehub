import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, Image as ImageIcon, RefreshCw, Wallet } from "lucide-react";
import type { TreasuryBalance, TreasuryNFT } from "@/lib/dao";
import { TokenLogo } from "@/components/TokenLogo";
import { TreasuryNftImage } from "./TreasuryNftImage";
import { TreasuryDeposit } from "./TreasuryDeposit";
import { TreasuryNFTDeposit } from "./TreasuryNFTDeposit";

interface DaoTreasurySectionProps {
  daoName: string;
  treasury: TreasuryBalance[];
  treasuryNFTs: TreasuryNFT[];
  treasuryLoaded: boolean;
  onRefresh: () => void;
}

/** "Treasury" tab of the DAO detail page. DaoDetail owns loading and refresh. */
export function DaoTreasurySection({ daoName, treasury, treasuryNFTs, treasuryLoaded, onRefresh }: DaoTreasurySectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Treasury
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={!treasuryLoaded}
        >
          {!treasuryLoaded ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span className="ml-1">Refresh</span>
            </>
          )}
        </Button>
      </div>

      {/* Treasury Token Balances */}
      {!treasuryLoaded ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : treasury.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
          <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No Treasury Balance</p>
          <p className="text-sm">Deposit tokens below to fund this DAO</p>
        </div>
      ) : (
        <div className="space-y-2">
          {treasury.map((balance, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <TokenLogo contract={balance.contract} symbol={balance.symbol} size="lg" className="h-10 w-10" />
                <div>
                  <p className="font-medium">{balance.symbol}</p>
                  <p className="text-xs text-muted-foreground">{balance.contract}</p>
                </div>
              </div>
              <p className="text-lg font-bold">{balance.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Treasury NFTs */}
      {treasuryLoaded && treasuryNFTs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-sm">NFTs in Treasury</h4>
            <Badge variant="secondary" className="text-xs">{treasuryNFTs.length}</Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {treasuryNFTs.map(nft => (
              <div
                key={nft.asset_id}
                className="relative aspect-square rounded-lg overflow-hidden border border-border/50"
              >
                <TreasuryNftImage image={nft.image} name={nft.name} />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <p className="text-[8px] text-white truncate">{nft.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Token Deposit Form */}
      <TreasuryDeposit daoName={daoName} onDeposited={onRefresh} />

      {/* NFT Deposit Form */}
      <TreasuryNFTDeposit daoName={daoName} onDeposited={onRefresh} />

      {/* Withdrawal Info */}
      <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">How to withdraw from treasury?</p>
        <p>Create a <span className="text-primary font-medium">Token Transfer</span> or <span className="text-primary font-medium">NFT Transfer</span> proposal. Once the proposal passes, the assets will be transferred to the specified recipient.</p>
      </div>
    </div>
  );
}
