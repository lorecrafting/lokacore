// Reads the collision probe off the running author preview (bin/author.sh) and walks the Book so
// `onPage` is measured over real views, not guessed. loka-wfrgk.100.8's first step.
//
// The probe only reaches the PANEL window (panel.tsx:204 posts into `panel`, which the panel page
// sets by messaging first), so this loads the panel and drives the Book in its iframe.
// # ponytail: one script, no framework; delete once .100.8 is decided.
import { chromium } from 'playwright';

const PANEL = process.env.PANEL_URL ?? 'http://localhost:19009/';
const STEPS = Number(process.env.STEPS ?? 40);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(PANEL);

// The Book is the panel's iframe; it is where lines are drawn and where clicks go.
const book = await (async () => {
  for (let i = 0; i < 60; i++) {
    const f = page.frames().find((x) => x !== page.mainFrame() && /:19006/.test(x.url()));
    if (f) return f;
    await page.waitForTimeout(500);
  }
  throw new Error('no Book frame: is bin/author.sh running?');
})();
await book.waitForSelector('[dir="auto"]', { timeout: 25000 });

/** The words the Book draws now. */
const drawn = () =>
  book.evaluate(() =>
    [...document.querySelectorAll('[dir="auto"]')]
      .map((el) => el.textContent?.trim())
      .filter(Boolean),
  );

/** The latest state the Book posted to the panel: the probe rides along in it. */
let latest;
await page.exposeFunction('__lokaState', (s) => (latest = s));
await page.evaluate(() => {
  window.addEventListener('message', (e) => {
    if (e.data?.loka === 'author' && e.data.state) window.__lokaState?.(e.data.state);
  });
});

const pages = [];
for (let i = 0; i < STEPS; i++) {
  const words = await drawn();
  pages.push(words);
  const before = words.join('|');
  // Turn the page the way a reader does: the last drawn line, else the right arrow.
  const line = book.locator('[dir="auto"]').last();
  await line.click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  if ((await drawn()).join('|') === before) {
    await book
      .locator('body')
      .press('ArrowRight')
      .catch(() => {});
    await page.waitForTimeout(200);
    if ((await drawn()).join('|') === before) break;
  }
}

const lost = latest?.lost ?? [];
const seen = pages.map((w) => new Set(w));
const onPage = lost.filter((g) => seen.some((s) => s.has(g.words)));
const share = lost.length ? onPage.length / lost.length : null;

console.log(
  JSON.stringify(
    {
      pagesWalked: pages.length,
      groups: lost.length,
      onPage: onPage.length,
      share: share === null ? null : +share.toFixed(3),
      verdict: !lost.length
        ? 'no collisions recorded: either the walk saw none, or the probe is not live'
        : share > 0.5
          ? 'same-view collisions dominate: the data-loka-key attribute is the fix'
          : 'mostly cross-view: clearing `seen` per render is enough and much smaller',
      onPageSample: onPage.slice(0, 12),
      crossViewSample: lost.filter((g) => !onPage.includes(g)).slice(0, 8),
    },
    null,
    2,
  ),
);
await browser.close();
