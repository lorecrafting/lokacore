// Book routes the browser tests and walks share: reduced motion, a new Ashmere game and a walk by
// the map.
import type { Browser } from '@e2e-dev/web';
import { expect, type TestFixtures } from 'e2e';

export type Screen = TestFixtures['screen'];

// Long walks turn pages by the reduced-motion cross-fade: headless software rendering draws the page
// curl too slowly for them (page_turn.e2e.ts covers the curl). Call before the test's first page.
export async function reducedMotion(browser: Browser) {
  await browser.addInitScript(() => {
    const media = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q.includes('prefers-reduced-motion')
        ? ({ ...media(q), matches: true } as MediaQueryList)
        : media(q);
  });
}

// A cleared save, the ancestry picked and the opening continued, at the Ferry Landing: the
// retired Ashmere chapter (deleted in phase 2), served only by `bin/loka dev`.
export async function begin(
  { app, screen }: Pick<TestFixtures, 'app' | 'screen'>,
  ancestry: string,
) {
  await app.clearState();
  await screen.getByRole('button', ancestry).tap();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Ferry Landing, look')).toBeVisible();
}

// One step by the Map page; with a room, the step must arrive there.
export async function go(screen: Screen, direction: string, room?: string) {
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', `Go ${direction}`).tap();
  if (room) await expect(screen.getByRole('button', `${room}, look`)).toBeVisible();
}
