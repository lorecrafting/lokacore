// npm run test:phone (loka-hcnlh.61): the builder's phase 1-2 acceptance and the Safari save path in
// Playwright WebKit with an iPhone profile (touch, 393 px, iOS UA). The e2e runner cannot turn touch
// on, so this drives Playwright directly, as .storybook/live.ts does. It compiles a copy of
// cellar_sampler with `bin/loka dev --watch`, serves the author preview (`npm run author`) on free
// ports, and stops both. Out of reach of emulation: the real keyboard and the notch.
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL } from '../book/labels.ts';
import { devices, webkit, type BrowserContext, type Locator, type Page } from 'playwright';

const app = resolve(import.meta.dirname, '..');
const repo = resolve(app, '../..');
const tmp = mkdtempSync(join(tmpdir(), 'loka-phone-'));
const cart = join(tmp, 'cart');
const artifact = '.dev-cartridge/phone/current.json'; // under mobile/app: Metro serves only its own tree
// ponytail: a probed port is free only until a server takes it; a clash fails before() as `exited`.
const free = () =>
  new Promise<number>((found) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => found(port));
    });
  });
const [author, preview, metro, ca] = [await free(), await free(), await free(), await free()];
const env = {
  ...process.env,
  LOKA_DEV_CARTRIDGE: artifact,
  LOKA_AUTHOR_PORT: `${author}`,
  LOKA_PREVIEW_PORT: `${preview}`,
  LOKA_METRO_PORT: `${metro}`,
  LOKA_CA_PORT: `${ca}`,
};
const url = `http://localhost:${preview}/`;
const servers: ChildProcess[] = [];
const serve = (cmd: string, args: string[], cwd: string) => {
  const s = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  servers.push(s);
  return (s.stdout.resume(), s); // drained: a full pipe would stall the server
};
// Polls `ok` until true; fails early when a server has exited, as nothing then would answer.
async function wait(ok: () => boolean | Promise<boolean>, what: string) {
  for (
    const start = performance.now();
    !(await ok());
    await new Promise((r) => setTimeout(r, 500))
  ) {
    const dead = servers.find((s) => s.exitCode !== null || s.signalCode !== null);
    if (dead)
      throw new Error(`${dead.spawnargs.join(' ')} exited: ${dead.exitCode ?? dead.signalCode}`);
    if (performance.now() - start > 120_000) throw new Error(`${what} not in 120 s`);
  }
}
// iPhone 15: 393 x 659, touch, iOS Safari UA. A persistent profile, as Safari's: an ephemeral
// WebKit context opens no OPFS, so the save could not be opened at all.
const phone = (name: string) =>
  webkit.launchPersistentContext(join(tmp, name), {
    ...devices['iPhone 15'],
    reducedMotion: 'reduce', // the cross-fade: headless software rendering draws the curl too slowly
  });
const LONG = { timeout: 300_000 }; // the first page waits out Metro's cold bundle

before(async () => {
  cpSync(join(repo, 'cartridges/cellar_sampler'), cart, { recursive: true });
  let watching = false; // the watcher's line once its first compile wrote the artifact
  serve('bin/loka', ['dev', cart, '--watch'], repo).stdout.on(
    'data',
    (b) => (watching ||= `${b}`.includes('Watching ')),
  );
  await wait(() => watching, 'the watcher');
  assert.ok(existsSync(join(app, artifact)), 'bin/loka dev compiled the copy');
  serve('node', ['preview-server.cjs'], app);
  await wait(
    () =>
      fetch(url).then(
        (r) => r.ok,
        () => false,
      ),
    'the preview',
  );
});

after(async () => {
  await ctx?.close(); // the builder's profile lives in tmp
  for (const s of servers)
    try {
      process.kill(-s.pid!, 'SIGTERM');
    } catch {} // already gone
  rmSync(tmp, { recursive: true, force: true });
  rmSync(join(app, artifact, '..'), { recursive: true, force: true });
});

const room = (p: Page, name: string) => p.getByRole('button', { name: `${name}, look` });
// One step by the footer's walking key (tests/steps.ts); the keys listen once the last step landed.
async function go(p: Page, key: string, to: string) {
  await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'Map', exact: true }).last().press(key);
  await room(p, to).waitFor();
}

test(
  'the save holds ten actions over two reloads, and a second tab waits on Try again',
  LONG,
  async () => {
    const ctx = await phone('save');
    try {
      const p = ctx.pages()[0] ?? (await ctx.newPage());
      await p.goto(url, LONG);
      await room(p, 'Ferry Landing').tap(LONG);
      // nine steps up and down a line of rooms; only the last reaches North Gate, so a save short of it shows
      for (const [key, to] of [
        ['ArrowUp', 'Well Lane'],
        ['ArrowUp', 'Village Green'],
        ['ArrowDown', 'Well Lane'],
        ['ArrowDown', 'Ferry Landing'],
        ['ArrowUp', 'Well Lane'],
        ['ArrowUp', 'Village Green'],
        ['ArrowDown', 'Well Lane'],
        ['ArrowUp', 'Village Green'],
        ['ArrowUp', 'North Gate'],
      ])
        await go(p, key, to);
      // Catches: the OPFS save (patch-sqlite-web.cjs) not persisting, or a reload left holding the
      // lock its own last page took (#803's pagehide), so the second reload fails to open.
      for (const _ of [1, 2]) {
        await p.reload();
        await room(p, 'North Gate').waitFor(LONG);
      }
      // Catches: a second tab crashing or offering only Start over on the held save, not Try again
      // (loka-hcnlh.19.2/.19.3); and Try again not reopening once the first tab lets go.
      const second = await ctx.newPage();
      await second.goto(url);
      await second.getByRole('button', { name: 'Try again' }).waitFor(LONG);
      await p.close();
      await second.getByRole('button', { name: 'Try again' }).tap();
      await room(second, 'North Gate').waitFor(LONG);
    } finally {
      await ctx.close();
    }
  },
);

let ctx: BrowserContext;
let p: Page;
const sheet = () => p.getByRole('dialog');
const grip = () => sheet().getByRole('button', { name: 'Full height' });
// The sheet's share of the Book's height it floats over: 0.5 half, 1 full, 0 closed.
const share = () =>
  p.evaluate(() => {
    const d = document.querySelector<HTMLElement>('[role=dialog]');
    return d ? d.offsetHeight / (d.offsetParent as HTMLElement).offsetHeight : 0;
  });
const until = async (ok: () => boolean | Promise<boolean>, what: string) => {
  for (const start = performance.now(); !(await ok()); await new Promise((r) => setTimeout(r, 200)))
    if (performance.now() - start > 20_000) throw new Error(`not ${what} in 20 s`);
};
// A one-finger drag by `dy` px. Playwright's touchscreen only taps, and WebKit has no Touch
// constructor, so the touches are made the iOS way (document.createTouch) and dispatched.
async function drag(l: Locator, dy: number) {
  const b = (await l.boundingBox())!;
  const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
  await l.evaluate(
    (el, { x, y, dy }) => {
      const d = document as Document & {
        createTouch(...a: unknown[]): Touch;
        createTouchList(...t: Touch[]): Touch[]; // typed as the init's array: WebKit refuses a real one
      };
      const list = (yy?: number) =>
        yy === undefined
          ? d.createTouchList()
          : d.createTouchList(d.createTouch(window, el, 1, x, yy, x, yy));
      const fire = (type: string, yy: number, held: boolean) =>
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: list(held ? yy : undefined),
            targetTouches: list(held ? yy : undefined),
            changedTouches: list(yy),
          }),
        );
      const pause = () => new Promise((r) => setTimeout(r, 100)); // a finger's pace, past press delays
      return (async () => {
        fire('touchstart', y, true);
        for (const step of [1, 2, 3, 4])
          await pause().then(() => fire('touchmove', y + (dy * step) / 4, true));
        await pause().then(() => fire('touchend', y + dy, false));
      })();
    },
    { x, y, dy },
  );
}
const said = () =>
  JSON.parse(readFileSync(join(cart, 'text.json'), 'utf8'))['room.ferry_landing.description'];
const exits = (key: string) =>
  JSON.parse(readFileSync(join(cart, `rooms/${key}.json`), 'utf8')).exits ?? {};

// The builder's page, opened once with Build on and the Room sheet up; the checks run in order.
let opened: Promise<void> | undefined;
const builder = () =>
  (opened ??= (async () => {
    ctx = await phone('build');
    p = ctx.pages()[0] ?? (await ctx.newPage());
    await p.goto(`${url}?dev=1`, LONG);
    await p.getByRole('switch', { name: 'Build' }).tap(LONG);
    await p.getByRole('button', { name: 'Edit Ferry Landing' }).tap();
  })());

// Catches: the sheet docking beside the Book at phone width (DOCK.at), or a row overflowing it.
test('the Room sheet rises over the Book at half height, full width, modal', LONG, async () => {
  await builder();
  assert.equal(Math.round((await sheet().boundingBox())!.width), p.viewportSize()!.width);
  assert.ok(Math.abs((await share()) - 0.5) < 0.01, `half height, was ${await share()}`);
  assert.equal(await sheet().getAttribute('aria-modal'), 'true');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

// Catches: + Add here not making the thing, not opening its sheet, or the reload its compile
// brings losing that sheet. It goes before the other gestures so the reload lands inside it.
test('+ Add here makes a person and opens its sheet', LONG, async () => {
  await builder();
  const reloaded = p.waitForEvent('load', LONG);
  await sheet().getByRole('button', { name: 'Person' }).tap();
  await sheet().getByText('npcs/npc_1.json').waitFor();
  await reloaded; // a new person is a structural compile: the Book reloads, keeping its sheets
  await sheet().getByText('npcs/npc_1.json').waitFor();
  await sheet().getByRole('button', { name: LABEL.back }).tap();
  await sheet().getByText('rooms/ferry_landing.json').waitFor();
});

// Catches: the grip reading a drag as a tap (a drag down from half would fill, not close), or
// the page taking the drag as a scroll.
test(
  'the grip fills the sheet on a drag up and closes it on a drag down from half',
  LONG,
  async () => {
    await builder();
    await drag(grip(), -100);
    await until(async () => (await share()) > 0.99, 'full');
    await drag(grip(), 100);
    await until(async () => Math.abs((await share()) - 0.5) < 0.01, 'half');
    await drag(grip(), 100);
    await until(async () => (await share()) === 0, 'closed');
  },
);

// Catches: a tap on a line not opening its in-place field, Save not writing, or Undo not
// putting the words back.
test('a line edits in place, and Undo puts it back', LONG, async () => {
  await builder();
  const line = p.getByRole('button', { name: /^Reeds crowd .*, edit$/ });
  const was = said();
  await line.tap();
  await p.getByRole('textbox').fill('A wet landing.');
  await p.getByRole('button', { name: 'Save' }).tap();
  await p.getByRole('button', { name: 'A wet landing., edit' }).waitFor();
  assert.equal(said(), 'A wet landing.', 'Save wrote the source');
  await p.getByRole('button', { name: 'Undo' }).tap();
  await p.getByRole('button', { name: `${was}, edit` }).waitFor();
  assert.equal(said(), was, 'Undo wrote the old words back');
});

// Catches: a Room sheet exit gesture that taps but writes nothing, or writes the wrong face.
test('the Room sheet adds an exit, makes one one-way and deletes one', LONG, async () => {
  await builder();
  await p.getByRole('button', { name: 'Edit Ferry Landing' }).tap();
  let reloaded = p.waitForEvent('load', LONG); // an exit edit is a structural compile: the Book reloads
  await sheet().getByRole('button', { name: '＋ south' }).tap();
  await reloaded;
  await sheet()
    .getByText(/^south → /)
    .waitFor();
  assert.ok(exits('ferry_landing').south, 'the new exit is in the source');
  reloaded = p.waitForEvent('load', LONG);
  await sheet().getByRole('button', { name: 'One-way' }).first().tap(); // north → Well Lane
  await reloaded;
  await until(() => exits('well_lane').south === undefined, 'one-way');
  assert.ok(exits('ferry_landing').north, 'the near face stays');
  const grown = exits('ferry_landing').south.to;
  await sheet().getByRole('button', { name: 'Delete', exact: true }).nth(1).tap(); // south
  await until(() => exits('ferry_landing').south === undefined, 'deleted');
  assert.equal(exits(grown).north, undefined, 'the far face goes too');
});
