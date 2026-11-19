import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Info, Image as ImageIcon, Clock, BarChart3, Tag, Vote } from "lucide-react";
import { DAO_TYPES, PROPOSER_TYPES, type DaoInfo } from "@/lib/dao";
import type { DaoSocialEntry } from "@/lib/daoSocials";

interface DaoInfoSectionProps {
  dao: DaoInfo;
  proposalsCount: number;
  socialEntries: DaoSocialEntry[];
  cover: { src?: string | null; onError?: () => void };
}

/** "DAO Info" tab of the DAO detail page. Presentational only. */
export function DaoInfoSection({ dao, proposalsCount, socialEntries, cover }: DaoInfoSectionProps) {
  const daoTypeLabel = DAO_TYPES[dao.dao_type] || "Unknown";
  return (
    <div className="space-y-6">
      {/* DAO Information header */}
      <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
        <Info className="h-4 w-4 text-primary" /> DAO Information
      </h3>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{dao.threshold}%</p>
            <p className="text-[11px] text-muted-foreground">Vote Threshold</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{dao.hours_per_proposal}h</p>
            <p className="text-[11px] text-muted-foreground">Vote Duration</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <Vote className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{proposalsCount}</p>
            <p className="text-[11px] text-muted-foreground">Total Proposals</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <Tag className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">
              {dao.proposal_cost && dao.proposal_cost !== "0" ? dao.proposal_cost : "Free"}
            </p>
            <p className="text-[11px] text-muted-foreground">Proposal Cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Governance Settings */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Governance Settings</h4>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="px-4 py-2.5 text-muted-foreground">DAO Type</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">{daoTypeLabel}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Who can propose</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">{PROPOSER_TYPES[dao.proposer_type] || "Unknown"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-muted-foreground">Token</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">
                    {dao.token_symbol ? `${dao.token_symbol} (${dao.token_contract})` : "N/A"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">Min votes required</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">
                    {dao.minimum_votes > 0 ? dao.minimum_votes.toLocaleString() : "0"}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {dao.description && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Description</h4>
          <Card className="bg-card/60 border-border/40">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dao.description}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Social Links */}
      {socialEntries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Social Links</h4>
          <Card className="bg-card/60 border-border/40">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {socialEntries.map(s => (
                  <Button key={s.key} variant="outline" size="sm" asChild className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
                    <a
                      href={s.url.startsWith("http") ? s.url : `https://${s.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="text-xs">{s.label}</span>
                    </a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cover Image */}
      {cover.src && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
            <ImageIcon className="h-4 w-4 text-primary" /> Cover Image
          </h4>
          <Card className="bg-card/60 border-border/40 overflow-hidden">
            <CardContent className="p-0">
              <img
                src={cover.src}
                alt={`${dao.dao_name} cover`}
                className="w-full h-auto max-h-[500px] object-contain"
                onError={cover.onError}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Authors */}
      {dao.authors && dao.authors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Authors</h4>
          <div className="flex flex-wrap gap-1">
            {dao.authors.map(a => (
              <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Authors are fixed at DAO creation and cannot be modified.</p>
        </div>
      )}

      {/* Governance Schemas */}
      {dao.gov_schemas && dao.gov_schemas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Governance Schemas</h4>
          <div className="flex flex-wrap gap-1">
            {dao.gov_schemas.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {s.collection_name} / {s.schema_name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
