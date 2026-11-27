// CHEESEDao optional members-only proposal teaser.
// The setting rides in the DAO's on-chain profile description as a trailing tag,
// because dao.waxdao has no config field for it. Display-only: chain tables stay public.

export const TEASER_TAG = "[cheese:members-teaser]";

/** Split a raw profile description into the visible text and the teaser flag. */
export function parseTeaserTag(raw: string): { description: string; teaser: boolean } {
  const text = raw || "";
  const teaser = text.includes(TEASER_TAG);
  const description = teaser ? text.split(TEASER_TAG).join("").replace(/\s+$/, "") : text;
  return { description, teaser };
}

/** Rebuild the raw description to save, adding the tag only when teaser is on. */
export function applyTeaserTag(description: string, teaser: boolean): string {
  const clean = parseTeaserTag(description).description;
  return teaser ? (clean ? `${clean}\n\n${TEASER_TAG}` : TEASER_TAG) : clean;
}

/** Non-members see only the teaser when the DAO opted in; members, authors and the creator see everything. */
export function proposalsLocked(teaser: boolean, viewerHasAccess: boolean): boolean {
  return teaser && !viewerHasAccess;
}
