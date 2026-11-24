// The author preview reloads itself on every structural compile (App.tsx loka_dev_hash). Safari keeps
// the old page alive for a moment (and in its back/forward cache), still holding the save's OPFS lock;
// the new page then waits on it and every press stays "save not confirmed" (loka-hcnlh.19.1). So the
// hidden page lets go of the save, and a page Safari restores from its cache reloads instead of
// playing on a closed save. A write cut off here reconciles on the next open, as any lost COMMIT does.
type Page = Pick<EventTarget, 'addEventListener'>;
export function releaseOnHide(page: Page, close: () => void, reload: () => void) {
  page.addEventListener('pagehide', close);
  page.addEventListener(
    'pageshow',
    (e) => (e as Event & { persisted?: boolean }).persisted && reload(),
  );
}
