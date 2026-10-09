// npm run storybook:picker (Beads loka-x6t.3): the picker end to end on a dev server with its own
// queue directory. Breaks it catches: a pick that reaches the queue without its owner chain or
// story id; a status line bin/polish_status.sh wrote that the panel does not show; Close batch
// enabled while an item is working; an overlay that moves a story box while Pick is on.
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Frame, type Page } from 'playwright';

const port = await new Promise<number>((found) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address() as { port: number };
    probe.close(() => found(port));
  });
});
const url = `http://localhost:${port}`;
const dir = mkdtempSync(join(tmpdir(), 'loka-polish-'));
const app = new URL('../..', import.meta.url);
const server = spawn(
  'npx',
  ['storybook', 'dev', '-p', `${port}`, '--host', '127.0.0.1', '--ci', '--no-open'],
  {
    cwd: app,
    env: { ...process.env, LOKA_POLISH_DIR: dir },
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: true,
  },
);
const status = (...args: string[]) =>
  execFileSync(new URL('../../../../bin/polish_status.sh', import.meta.url).pathname, args, {
    env: { ...process.env, LOKA_POLISH_DIR: dir },
  });
const lines = (file: string) =>
  readFileSync(join(dir, file), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
const fail = (why: string) => {
  throw new Error(why);
};
// Every box under the story root, rounded: the overlay must leave them as they are.
const boxes = (frame: Frame) =>
  frame.evaluate(() =>
    [...document.querySelectorAll('#storybook-root *')].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    }),
  );
const settle = async (page: Page, text: string) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout: 10_000 });

try {
  for (const start = Date.now(); ; await new Promise((r) => setTimeout(r, 500))) {
    if (server.exitCode !== null) throw new Error(`storybook dev exited ${server.exitCode}`);
    if (Date.now() - start > 120_000) throw new Error('storybook dev did not start in 120 s');
    if (
      await fetch(`${url}/index.json`).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const story = 'book-entityline--item';
    await page.goto(`${url}/?path=/story/${story}`);
    const preview = (await (
      await page.waitForSelector('#storybook-preview-iframe')
    ).contentFrame())!;
    const button = preview.locator('[role="button"]').first();
    await button.waitFor();
    await preview.evaluate(() => document.fonts.ready); // the Book's fonts resize text boxes
    const before = await boxes(preview);
    await page.click('[title="Pick an element (P)"]');
    await settle(page, 'Press P or Pick');
    const b = (await button.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('button[title="Remove"]'); // the pending chip in the composer
    const after = await boxes(preview);
    if (after.join('|') !== before.join('|')) fail('the overlay moved a story box while picking');
    await page.fill('textarea[placeholder="What should change?"]', 'quick: tighten the row');
    await page.keyboard.press('Meta+Enter');
    await settle(page, 'queued for Beads');
    const [pick] = lines('picks.jsonl');
    if (lines('picks.jsonl').length !== 1) fail('want exactly one pick line');
    if (pick.story?.id !== story) fail(`pick story id ${pick.story?.id}, want ${story}`);
    if (!pick.elements?.[0]?.chain.includes('EntityLine'))
      fail(`chain ${JSON.stringify(pick.elements?.[0]?.chain)} lacks EntityLine`);
    if (pick.note !== 'quick: tighten the row') fail(`note ${pick.note}`);
    status(pick.id, 'working', 'fable');
    status('suggest-close', 'enough for one review');
    await settle(page, 'suggest closing: enough for one review');
    await page.waitForSelector('[data-pick] >> text=working');
    const closeBtn = page.locator('button:has-text("Close batch")').first();
    if (!(await closeBtn.isDisabled())) fail('Close batch enabled while an item is working');
    status(pick.id, 'done', 'fable', 'row tightened', 'abc1234');
    await settle(page, 'row tightened');
    if (await closeBtn.isDisabled()) fail('Close batch still disabled after done');
    console.log(`ok   picker: ${pick.id} ${pick.elements[0].chain.join(' › ')} in ${story}`);
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) process.kill(-server.pid!, 'SIGTERM');
  rmSync(dir, { recursive: true, force: true });
}
