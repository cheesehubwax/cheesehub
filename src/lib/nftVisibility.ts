// Share one viewport observer across tiles; a 300px margin prefetches rows just before they scroll in.
const listeners = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | undefined;

export function observeNftVisibility(element: Element, onChange: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true);
    return () => {};
  }
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    }, { rootMargin: '300px 0px' });
  }
  listeners.set(element, onChange);
  observer.observe(element);
  return () => {
    listeners.delete(element);
    observer?.unobserve(element);
    if (!listeners.size) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}