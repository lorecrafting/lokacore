import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { go, inventory, litTorch, reopen, type Screen, reducedMotion, settled } from './steps.ts';

// Long walks: the pages cross-fade (steps.ts reducedMotion).
beforeEach(({ browser }) => reducedMotion(browser));

// Breaks: the actual swim lesson, either bottom route, detail countdown or free Surface is lost in the browser Book.
test('both water bottoms keep lit loot and a free Surface across browser reload', async ({
  app,
  screen,
  browser,
}) => {
  await app.clearState();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'north', 'Well Lane');
  await go(screen, 'west', 'Chandler');
  await litTorch(screen);
  await go(screen, 'east', 'Well Lane');
  await go(screen, 'south', 'Ferry Landing');
  await learnSwim(screen);
  await expect(screen.getByText(/You have learned swim/)).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await ferryBack(screen);
  await toWellBottom(screen);
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await screen.getByRole('button', 'Old coin is here., open').tap();
  await expect(screen.getByText(/A worn coin, green with age/)).toBeVisible();
  await settled(browser); // the room page, with its own countdown, fades out
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Well Bottom, look')).toBeVisible();
  await settled(browser);
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await screen.getByRole('button', 'Surface (free)').tap();
  await expect(screen.getByRole('button', 'Well Shaft, look')).toBeVisible();
  await go(screen, 'up', 'Well Lane');
  await go(screen, 'south', 'Ferry Landing');
  await toPoolBottom(screen);
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await expect(screen.getByRole('button', 'Sunken chest is here., open')).toBeVisible();
  await screen.getByRole('button', 'Surface (free)').tap();
  await expect(screen.getByRole('button', 'Black Pool, look')).toBeVisible();
});

// Breaks: an elapsed browser reopen renews a dive or Chapel recovery loses the original carried item.
test('expired dive returns to Chapel and recovers original belongings once after reload', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(offsetClock);
  await app.clearState();
  await browser.reload();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'north', 'Well Lane');
  await go(screen, 'west', 'Chandler');
  await screen.getByRole('button', /^Peg Harrow is here\./).tap();
  await screen.getByRole('button', 'Buy a torch — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await go(screen, 'east', 'Well Lane');
  await go(screen, 'south', 'Ferry Landing');
  await learnSwim(screen);
  await screen.getByRole('button', 'Leave').tap();
  await ferryBack(screen);
  await toWellBottom(screen);
  await browser.evaluate(() => {
    localStorage.setItem('d6-clock-offset', String(121_000));
    return true;
  });
  await reopen({ app, screen });
  await expect(screen.getByRole('button', 'Chapel Nave, look')).toBeVisible();
  await expect(screen.getByRole('button', /Recover belongings from Well Bottom/)).toBeVisible();
  await screen.getByRole('button', /Recover belongings from Well Bottom/).tap();
  await reopen({ app, screen });
  await inventory(screen);
  await expect(screen.getByRole('button', 'a torch, open')).toBeVisible();
});

// From the Ferry Landing: the paid ferry to the isle and Mother Sedge's free swim lesson.
async function learnSwim(screen: Screen) {
  await go(screen, 'west', 'Boathouse');
  await screen.getByRole('button', 'Rope ferry, open').tap();
  await screen.getByRole('button', 'Board — 2p').doubleTap();
  await go(screen, 'east', 'Isle Hut');
  await screen.getByRole('button', /^Mother Sedge is here\./).tap();
  await screen.getByRole('button', 'Learn swim — free Mother Sedge').tap();
  await screen.getByRole('button', 'Learn swim — free').tap();
}

// From Isle Hut: the free ferry back to the Ferry Landing.
async function ferryBack(screen: Screen) {
  await go(screen, 'west', 'Fen Isle Landing');
  await screen.getByRole('button', 'Rope ferry, open').tap();
  await screen.getByRole('button', 'Return — free').tap();
  await go(screen, 'east', 'Ferry Landing');
}

// From the Ferry Landing down the well.
async function toWellBottom(screen: Screen) {
  await go(screen, 'north', 'Well Lane');
  await go(screen, 'down', 'Well Shaft');
  await go(screen, 'down', 'Well Bottom');
}

// From the Ferry Landing south to the Black Pool and down.
async function toPoolBottom(screen: Screen) {
  await go(screen, 'south', 'Reed Path');
  await go(screen, 'south', 'Reed Bank');
  await go(screen, 'west', 'Willow Shade');
  await go(screen, 'south', 'Drowned Oak');
  await go(screen, 'south', 'Black Pool');
  await go(screen, 'down', 'Pool Bottom');
}

// A clock the test advances through localStorage.
function offsetClock() {
  const base = Date.now();
  Date.now = () => base + Number(localStorage.getItem('d6-clock-offset') ?? 0);
  Object.defineProperty(performance, 'now', {
    value: () => Number(localStorage.getItem('d6-clock-offset') ?? 0),
  });
}
