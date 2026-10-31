// Book routes the browser tests and walks share: reduced motion and a walk by the footer's keys.
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

// The footer's walking keys (book-ui.md, Minimap): an open exit walks; a shut door opens or unlocks.
const KEY: Record<string, string> = {
  north: 'ArrowUp',
  south: 'ArrowDown',
  west: 'ArrowLeft',
  east: 'ArrowRight',
  up: 'PageUp',
  down: 'PageDown',
};

// One step by the footer's key: a walk, or a shut door's Unlock or Open. The keys listen only once
// the last step has landed (Book.tsx keyboardEnabled), so it first waits out the 160 ms fade. With a
// room, the step must arrive there.
export async function go(screen: Screen, direction: string, room?: string) {
  if (!KEY[direction]) throw new Error(`no walking key for ${direction}`);
  await new Promise((r) => setTimeout(r, 250));
  await screen.getByRole('button', 'Map').press(KEY[direction]);
  if (room) await expect(screen.getByRole('button', `${room}, look`)).toBeVisible();
}
