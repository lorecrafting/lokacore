// The after shot for a done pick (bin/polish_status.sh done): the story at the pick's palette,
// Reading size and viewport, cropped like the before crop, to .polish/shots/<id>-<i>-after.png.
//   node .storybook/picker/after.ts <storybook port> <queue dir> <pick id>
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [port, dir, id] = process.argv.slice(2);
const pick = readFileSync(`${dir}/picks.jsonl`, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
  .find((p) => p.id === id);
const globals = [
  `palette:${pick.palette ?? 'light'}`,
  `reading:${pick.reading ?? 'Standard'}`,
].join(';');
// ponytail: a pick without a viewport (toolbar reset) falls back to the preview's iPhone 11.
const [width, height] = [pick.viewport?.width ?? 414, pick.viewport?.height ?? 896].map((v) =>
  parseInt(v, 10),
);

mkdirSync(`${dir}/shots`, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(
    `http://localhost:${port}/iframe.html?id=${pick.story.id}&globals=${globals}&viewMode=story`,
  );
  await page.waitForSelector('#storybook-root > *');
  await page.evaluate(() => document.fonts.ready);
  const full = await page.evaluate(() => [document.body.scrollWidth, document.body.scrollHeight]);
  // ponytail: the same region as the before crop (box + 24 px), not the element's new box; an
  // element that moved far needs a relocate by chain.
  for (const [i, { box }] of (
    pick.elements as { box: { x: number; y: number; w: number; h: number } }[]
  ).entries()) {
    const x = Math.max(0, box.x - 24);
    const y = Math.max(0, box.y - 24);
    const clip = {
      x,
      y,
      width: Math.min(box.w + 48, full[0] - x),
      height: Math.min(box.h + 48, full[1] - y),
    };
    await page.screenshot({ path: `${dir}/shots/${id}-${i}-after.png`, clip, fullPage: true });
  }
} finally {
  await browser.close();
}
