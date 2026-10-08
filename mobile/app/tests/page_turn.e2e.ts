import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// In the page: press `from` and watch until the leaving page has gone (its picture curling, or faded
// out); report whether the curl canvas drew and whether `to`, on the arriving page, received the
// pointer at its centre all the while, and how long (ms) the leaving page stayed over it.
const turn = async ({ from, to }: { from: string; to: string }) => {
  const frames = 600; // about 10 s at 60 fps
  for (let i = 0; i < frames && document.querySelector('canvas'); i++)
    await new Promise(requestAnimationFrame); // the previous turn's curl has gone
  (document.querySelector(`[aria-label="${from}"]`) as HTMLElement).click();
  let curl = false;
  let arrived: number | undefined; // the frame time the arriving page first showed
  let stayed = 0; // how long the leaving page stayed after that
  let hit: boolean | null = null; // null until the arriving page has rendered
  for (let i = 0; i < frames; i++) {
    const now = await new Promise<number>(requestAnimationFrame);
    const target = document.querySelector(`[aria-label="${to}"]`);
    if (target) {
      arrived ??= now;
      const box = target.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      hit = (hit ?? true) && !!top && target.contains(top);
    }
    if (document.querySelector('canvas')) curl = true;
    if (!document.querySelector(`[aria-label="${from}"]`)) {
      stayed = now - (arrived ?? now);
      break; // the leaving page has gone
    }
  }
  return { curl, hit, stayed };
};

// A cold Metro builds the preview's Skia chunk on first request; that once outlasted the default wait.
const COLD = 60_000;

// Breaks: the curl (or the leaving page held under it) takes the arriving page's touches, the
// leaving page's picture fails on web so nothing curls, or a back turn breaks the next press.
test('the page curl draws over a live arriving page, both ways', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/?preview=page-turn');
  await expect(screen.getByRole('button', 'Continue')).toBeVisible({ timeout: COLD });
  const args = { from: 'Continue', to: 'Start over' };
  expect(await browser.evaluate(turn, args)).toMatchObject({ curl: true, hit: true });
  await app.screenshot('page-curl-forward');
  const back = { from: 'Start over', to: 'Continue' };
  expect(await browser.evaluate(turn, back)).toMatchObject({ curl: true, hit: true });
});

// Breaks: reduced motion still curls, its cross-fading leaving page takes the touches, or the
// leaving page vanishes at once instead of fading over motion.fade (160 ms).
test('under reduced motion the pages cross-fade with no curl', async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    const media = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q.includes('prefers-reduced-motion')
        ? ({ ...media(q), matches: true } as MediaQueryList)
        : media(q);
  });
  await app.open('/?preview=page-turn');
  await expect(screen.getByRole('button', 'Continue')).toBeVisible({ timeout: COLD });
  const args = { from: 'Continue', to: 'Start over' };
  expect(await browser.evaluate(turn, args)).toMatchObject({ curl: false, hit: true });
  // Timed on the way back: the first mount of a page can stall the frames past the whole fade.
  const back = await browser.evaluate(turn, { from: 'Start over', to: 'Continue' });
  expect(back).toMatchObject({ curl: false, hit: true });
  expect(back.stayed).toBeGreaterThanOrEqual(150);
});
