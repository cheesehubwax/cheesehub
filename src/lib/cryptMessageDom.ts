/** Message keys are opaque receipt identities, not CSS selectors (and may include wire text). */
export function findCryptMessageNode(list: HTMLOListElement | null, key: string): HTMLElement | undefined {
  return list ? Array.from(list.querySelectorAll<HTMLElement>('[data-reply-key]')).find(node => node.dataset.replyKey === key) : undefined;
}