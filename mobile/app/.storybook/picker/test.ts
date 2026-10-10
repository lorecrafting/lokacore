// npm run storybook:picker (Beads loka-x6t.3): the picker end to end on a dev server with its own
// queue directory. Breaks it catches: a pick that reaches the queue without its owner chain or
// story id; a status line bin/polish_status.sh wrote that the panel does not show; Close batch
// enabled while an item is working; an overlay that moves a story box while Pick is on; an Esc in
// the composer that leaves Pick on (or the first one leaving it); Shift+Enter that sends or Enter
// that does not; a PM log line the panel does not show; a PM suggestion Tab does not take into the
// composer (or Tab moving focus); a suggestion still offered after the owner sent a prompt.
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
    env: { ...process.env, LOKA_POLISH_DIR: dir, LOKA_POLISH_SESSION: 'polish/session-test' },
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
    // Esc in the composer (focused by the pin): first clears, second turns Pick off.
    const layer = (display: string, why: string) =>
      preview
        .waitForFunction(
          (d) =>
            document.querySelector<HTMLElement>('div[style*="crosshair"]')?.style.display === d,
          display,
          { timeout: 5_000 },
        )
        .catch((e: Error) => fail(`${why} (${e.message.split('\n')[0]})`));
    await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA');
    await page.keyboard.press('Escape');
    await page.waitForSelector('button[title="Remove"]', { state: 'detached' });
    await layer('block', 'Pick off after the first Esc');
    await page.keyboard.press('Escape');
    await layer('none', 'Pick still on after Esc in the empty composer');
    await page.click('[title="Pick an element (P)"]');
    await layer('block', 'Pick not back on');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('button[title="Remove"]');
    await page.fill('textarea[placeholder="What should change?"]', 'quick: tighten');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('the row');
    await page.keyboard.press('Enter');
    await settle(page, 'received'); // the session's first status
    const [pick] = lines('picks.jsonl');
    if (lines('picks.jsonl').length !== 1) fail('want exactly one pick line');
    if (pick.story?.id !== story) fail(`pick story id ${pick.story?.id}, want ${story}`);
    if (!pick.elements?.[0]?.chain.includes('EntityLine'))
      fail(`chain ${JSON.stringify(pick.elements?.[0]?.chain)} lacks EntityLine`);
    if (pick.note !== 'quick: tighten\nthe row') fail(`note ${JSON.stringify(pick.note)}`);
    status(pick.id, 'working', 'fable');
    status('suggest-close', 'enough for one review');
    status('log', 'routed to Sonnet designer');
    await settle(page, 'routed to Sonnet designer');
    await settle(page, 'suggest closing: enough for one review');
    await page.waitForSelector('[data-pick] >> text=working');
    const closeBtn = page.locator('button:has-text("Close batch")').first();
    if (!(await closeBtn.isDisabled())) fail('Close batch enabled while an item is working');
    status(pick.id, 'done', 'fable', 'row tightened', 'abc1234');
    await settle(page, 'row tightened');
    if (await closeBtn.isDisabled()) fail('Close batch still disabled after done');
    status('suggest', 'Close batch');
    const area = page.locator('textarea[placeholder="Close batch"]'); // the ghost text
    await area.focus();
    await page.keyboard.press('Tab');
    if ((await area.inputValue()) !== 'Close batch') fail('Tab did not take the suggestion');
    if (!(await area.evaluate((el) => el === document.activeElement))) fail('Tab moved focus');
    await page.keyboard.press('Enter');
    await page
      .waitForSelector('textarea[placeholder="What should change?"]', { timeout: 5_000 })
      .catch(() => fail('the suggestion stayed after a sent prompt'));
    const note = lines('picks.jsonl').at(-1).note;
    if (note !== 'Close batch') fail(`sent ${JSON.stringify(note)}, want the suggestion`);
    console.log(`ok   picker: ${pick.id} ${pick.elements[0].chain.join(' › ')} in ${story}`);
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) process.kill(-server.pid!, 'SIGTERM');
  rmSync(dir, { recursive: true, force: true });
}
