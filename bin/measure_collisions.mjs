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

// The tutorial card covers the Book and eats the turn-the-page clicks, which kept the walk on page 1
// (three sessions called the measurement blocked on it). Dismiss it the way a reader does, once.
for (const label of ['Got it']) {
  await book
    .getByRole('button', { name: label, exact: true })
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});
}
await page.waitForTimeout(500);

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
// The rooms to visit: the story graph knows them, and `go_to_room` is the cheat the panel already
// accepts (mobile/app/author/place.ts:158), so the walk moves instead of hoping a drawn line is an exit.
const AUTHOR = process.env.AUTHOR_URL ?? 'http://localhost:19008/';
const ROOMS = await fetch(`${AUTHOR}story`)
  .then((r) => (r.ok ? r.json() : null))
  .then((j) =>
    (j?.graph?.nodes ?? [])
      .filter((n) => n.kind === 'room')
      .map((n) => n.ref.split(':room/').pop())
      .filter(Boolean),
  )
  .catch(() => []);

/** Ask the Book to stand in a room, then wait for the state that proves it arrived. */
const goTo = async (room) => {
  const before = (await drawn()).join('|');
  // The cheat handler is this frame's own window listener (mobile/app/author/panel.tsx:245), not its
  // parent's: posting to the parent reaches the author panel page, which does not drive the game.
  await book.evaluate((r) => window.postMessage({ op: 'go_to_room', room: r }, '*'), room);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    if ((await drawn()).join('|') !== before) return true;
  }
  return false;
};

if (ROOMS.length) {
  for (const room of ROOMS.slice(0, STEPS)) {
    await goTo(room);
    pages.push(await drawn());
  }
} else {
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
}

const lost = latest?.lost ?? [];
const seen = pages.map((w) => new Set(w));
const onPage = lost.filter((g) => seen.some((s) => s.has(g.words)));
const share = lost.length ? onPage.length / lost.length : null;
const distinct = new Set(pages.map((p) => p.join('|'))).size;

console.log(
  JSON.stringify(
    {
      pagesWalked: pages.length,
      distinctPages: distinct,
      rooms: ROOMS.length,
      groups: lost.length,
      onPage: onPage.length,
      share: share === null ? null : +share.toFixed(3),
      verdict:
        distinct < 3
          ? `the walk is not moving (${distinct} distinct pages over ${pages.length} steps): fix it before reading anything else`
          : !lost.length
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
