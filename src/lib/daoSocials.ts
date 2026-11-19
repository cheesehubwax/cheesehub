import type { DaoSocials } from "@/lib/dao";

export interface DaoSocialEntry { key: string; label: string; url: string }

/** Social links shown on a DAO's info tab, in display order; empty values are skipped. */
export function daoSocialEntries(socials: DaoSocials | undefined): DaoSocialEntry[] {
  if (!socials) return [];
const entries: { key: string; label: string; url: string }[] = [];
const s = socials;
if (s.twitter) entries.push({ key: "twitter", label: "Twitter", url: s.twitter });
if (s.discord) entries.push({ key: "discord", label: "Discord", url: s.discord });
if (s.telegram) entries.push({ key: "telegram", label: "Telegram", url: s.telegram });
if (s.website) entries.push({ key: "website", label: "Website", url: s.website });
if (s.atomichub) entries.push({ key: "atomichub", label: "AtomicHub", url: s.atomichub });
if (s.waxdao) entries.push({ key: "waxdao", label: "WaxDAO", url: s.waxdao });
if (s.youtube) entries.push({ key: "youtube", label: "YouTube", url: s.youtube });
if (s.medium) entries.push({ key: "medium", label: "Medium", url: s.medium });
return entries;
}
