import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, Image as ImageIcon, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import {
  DaoInfo, DAO_TYPES,
  fetchUserStakedTokens, fetchUserStakedNFTs, fetchUserTokenBalance,
  buildStakeTokenActions, buildUnstakeTokenAction,
  buildStakeNFTAction, buildUnstakeNFTAction,
  StakedToken, StakedNFT,
} from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { useToast } from "@/hooks/use-toast";
import { getIpfsUrl } from "@/lib/ipfsGateways";

interface DaoStakingProps {
  daoName: string;
  dao: DaoInfo;
}

export function DaoStaking({ daoName, dao }: DaoStakingProps) {
  const { accountName, session, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();

  const [stakedToken, setStakedToken] = useState<StakedToken | null>(null);
  const [stakedNFTs, setStakedNFTs] = useState<StakedNFT[]>([]);
  const [tokenBalance, setTokenBalance] = useState("0");
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);

  const isTokenDao = dao.dao_type === 4;
  const isNftDao = [1, 5].includes(dao.dao_type);

  useEffect(() => {
    if (!accountName) { setLoading(false); return; }
    loadStakingData();
  }, [accountName, daoName]);

  async function loadStakingData() {
    setLoading(true);
    try {
      if (isTokenDao && accountName) {
        const [staked, balance] = await Promise.all([
          fetchUserStakedTokens(daoName, accountName),
          fetchUserTokenBalance(
            dao.token_contract,
            dao.token_symbol.split(",").pop() || "",
            accountName
          ),
        ]);
        setStakedToken(staked);
        setTokenBalance(balance);
      }
      if (isNftDao && accountName) {
        const nfts = await fetchUserStakedNFTs(daoName, accountName);
        setStakedNFTs(nfts);
      }
    } catch (e) {
      console.error("Error loading staking data:", e);
    }
    setLoading(false);
  }

  const handleStakeTokens = async () => {
    if (!session || !accountName || !stakeAmount) return;
    setTxLoading(true);

    const symbolParts = dao.token_symbol.split(",");
    const precision = parseInt(symbolParts[0]) || 8;
    const symbol = symbolParts[1] || symbolParts[0];
    const formatted = `${parseFloat(stakeAmount).toFixed(precision)} ${symbol}`;

    const actions = buildStakeTokenActions(accountName, daoName, formatted, dao.token_contract);
    const result = await executeTransaction(actions, {
      successTitle: "Tokens Staked! 🧀",
      successDescription: `Staked ${formatted} to ${daoName}`,
    });
    if (result.success) {
      setStakeAmount("");
      loadStakingData();
    }
    setTxLoading(false);
  };

  const handleUnstakeTokens = async () => {
    if (!session || !accountName || !unstakeAmount) return;
    setTxLoading(true);

    const symbolParts = dao.token_symbol.split(",");
    const precision = parseInt(symbolParts[0]) || 8;
    const symbol = symbolParts[1] || symbolParts[0];
    const formatted = `${parseFloat(unstakeAmount).toFixed(precision)} ${symbol}`;

    const action = buildUnstakeTokenAction(accountName, daoName, formatted);
    const result = await executeTransaction([action], {
      successTitle: "Tokens Unstaked! 🧀",
      successDescription: `Unstaked ${formatted} from ${daoName}`,
    });
    if (result.success) {
      setUnstakeAmount("");
      loadStakingData();
    }
    setTxLoading(false);
  };

  const handleUnstakeNFT = async (assetId: string) => {
    if (!session || !accountName) return;
    setTxLoading(true);
    const action = buildUnstakeNFTAction(accountName, daoName, [assetId]);
    const result = await executeTransaction([action], {
      successTitle: "NFT Unstaked! 🧀",
    });
    if (result.success) loadStakingData();
    setTxLoading(false);
  };

  if (!isConnected) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Connect wallet to stake
      </div>
    );
  }

  if (dao.dao_type === 5) {
    return (
      <div className="text-center py-8">
        <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          This is a non-custodial Hold NFT DAO. No staking required — just hold eligible NFTs in your wallet to participate.
        </p>
        {dao.gov_schemas?.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Eligible Collections:</p>
            {dao.gov_schemas.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs mx-1">
                {s.collection_name} / {s.schema_name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Token Staking for Type 4 */}
      {isTokenDao && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Staked</p>
                <p className="text-lg font-bold text-primary">{stakedToken?.balance || "0"}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-lg font-bold">{tokenBalance}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/60 border-border/40">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-xs">Stake Tokens</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={stakeAmount}
                    onChange={e => setStakeAmount(e.target.value)}
                  />
                  <Button onClick={handleStakeTokens} disabled={txLoading || !stakeAmount} size="sm">
                    {txLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4 mr-1" />}
                    Stake
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Unstake Tokens</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={unstakeAmount}
                    onChange={e => setUnstakeAmount(e.target.value)}
                  />
                  <Button variant="outline" onClick={handleUnstakeTokens} disabled={txLoading || !unstakeAmount} size="sm">
                    {txLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4 mr-1" />}
                    Unstake
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* NFT Staking for Type 1 */}
      {isNftDao && dao.dao_type === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {stakedNFTs.length} NFTs staked in this DAO
          </p>
          {stakedNFTs.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">
              No NFTs staked yet. Transfer eligible NFTs to the DAO contract to stake.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stakedNFTs.map(nft => (
                <Card key={nft.asset_id} className="bg-card/60 border-border/40 overflow-hidden">
                  <div className="aspect-square bg-muted/30 flex items-center justify-center">
                    {nft.image ? (
                      <img
                        src={nft.image.startsWith("Qm") || nft.image.startsWith("bafy") ? getIpfsUrl(nft.image) : nft.image}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium truncate">{nft.name}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1 text-xs h-7"
                      onClick={() => handleUnstakeNFT(nft.asset_id)}
                      disabled={txLoading}
                    >
                      Unstake
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
