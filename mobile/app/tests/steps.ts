// Book routes the browser tests share: a new game, a walk by the map, the lit torch and a reopen.
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

// A cleared save, the ancestry picked and the opening continued, at the Ferry Landing.
// Until the leaving page's cross-fade is over: it stays in the DOM (inert, hidden from the screen
// reader) for motion.fade, and text both pages show would match twice.
export async function settled(browser: Browser) {
  await browser.evaluate(async () => {
    for (let i = 0; i < 120 && document.querySelector('[inert]'); i++)
      await new Promise(requestAnimationFrame);
    return null; // evaluate returns JSON
  });
}

export async function begin(
  { app, screen }: Pick<TestFixtures, 'app' | 'screen'>,
  ancestry: string,
) {
  await app.clearState();
  await screen.getByRole('button', ancestry).tap();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
}

// One step by the Map page; with a room, the step must arrive there.
export async function go(screen: Screen, direction: string, room?: string) {
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', `Go ${direction}`).tap();
  if (room) await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
}

export async function inventory(screen: Screen) {
  await screen.getByRole('button', /opens Contents, Character$/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
}

// At the Chandler: buy a torch from Peg for 3p and light it.
export async function litTorch(screen: Screen) {
  await screen.getByRole('button', /^Peg Harrow is here\./).tap();
  await screen.getByRole('button', 'Buy a torch — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await inventory(screen);
  await screen.getByRole('button', 'a torch, open').tap();
  await screen.getByRole('button', 'Ignite a torch').tap();
  await screen.getByRole('button', 'Leave').tap();
}

export async function reopen({ app, screen }: Pick<TestFixtures, 'app' | 'screen'>) {
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
}
