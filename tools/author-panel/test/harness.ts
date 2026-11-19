// The panel E2E's one Vite + bin/loka dev server pair and Chrome, on a copy of the toolbox showcase
// (panel.test.ts); its hooks attach to the importing test file, so the pair starts once per run.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before } from 'node:test';
import { chromium, type Browser, type Locator, type Page } from 'playwright';

const PANEL = resolve(import.meta.dirname, '..');
const ROOT = resolve(PANEL, '../..');
const free = () =>
  new Promise<number>((done) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });

let browser: Browser, url: string;
export let author: number;
export let boot = 120_000; // the first compile and Vite's first optimise
const procs: ChildProcess[] = [];
export const dir = mkdtempSync(join(tmpdir(), 'loka-panel-'));
before(async () => {
  const [a, panel, preview] = await Promise.all([free(), free(), free()]);
  author = a;
  const env = {
    ...process.env,
    LOKA_DEV_CARTRIDGE: join(dir, 'current.json'),
    LOKA_AUTHOR_PORT: `${author}`,
    LOKA_PANEL_PORT: `${panel}`,
    LOKA_PREVIEW_PORT: `${preview}`, // nothing serves it: the Book frame stays empty
  };
  const io: SpawnOptions = { env, detached: true, stdio: ['ignore', 'ignore', 'inherit'] };
  const showcase = join(dir, 'showcase'); // a copy: the block tests write
  cpSync(join(ROOT, 'cartridges/toolbox_showcase'), showcase, { recursive: true });
  for (const w of ['identity_sampler', 'scene_sampler'])
    // the scene test's POST /world siblings
    cpSync(join(ROOT, 'cartridges', w), join(dir, w), { recursive: true });
  procs.push(spawn(join(ROOT, 'bin/loka'), ['dev', showcase, '--watch'], io));
  procs.push(
    spawn(process.execPath, [join(PANEL, 'node_modules/vite/bin/vite.js')], { ...io, cwd: PANEL }),
  );
  url = `http://localhost:${panel}/`;
  browser = await chromium.launch({ channel: 'chrome' });
  await (await open(QUEST)).close();
  boot = 10_000; // booted: a mutant that blanks the card fails each open in seconds, inside mutate.sh's cap
  // Playwright's action timeout is unlimited by default, so a click, fill or selectOption on a
  // control that never settles waits forever: the suite hangs instead of naming the break
  // (loka-0ske4, loka-wfrgk.96). An action is bounded like a `waitFor`, once booted; a test that
  // legitimately needs longer says so on that call.
  browser.contexts().forEach((c) => c.setDefaultTimeout(boot));
});
after(async () => {
  await browser?.close();
  for (const p of procs) {
    try {
      process.kill(-p.pid!); // the process groups: mix and esbuild children too
    } catch {} // already gone: kill the rest
  }
  rmSync(dir, { recursive: true, force: true });
});

/** The panel with this layout kept, once the inspector's card has its form (the first compile and Vite's first optimise included). `before` runs on the page before it navigates: a route the first load must already obey. */
export async function open(
  layout: object,
  ready = 'Inspector',
  before?: (page: Page) => Promise<unknown>,
): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(
    (l) => localStorage.setItem('loka.editor.layout', l),
    JSON.stringify(layout),
  );
  await before?.(page);
  for (let i = 0; ; i++) {
    try {
      await page.goto(url);
      break;
    } catch (e) {
      if (i === 120) throw e; // Vite not listening yet
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  // any card's form, or the named control (a `.scene` card has no form)
  const at =
    ready === 'Inspector' ? page.locator('[aria-label="Inspector"] form') : page.getByLabel(ready);
  await at.waitFor({ timeout: boot });
  return page;
}
export const QUEST = { right: 280, selection: { kind: 'quest', key: 'carry_letter' } };

/** Switches the world and waits for the restarted watcher to serve it, as the panel's World button
 * does (world.tsx opens): POST /world answers 200 and then `bin/loka dev --watch` restarts, unbinding
 * the port, so a request in between is refused. Opening a page before it is back reported the restart
 * as a card that never loaded ('a line reworded on disk...', panel smoke, flaky until #754). */
export async function world(name: string) {
  const at = `http://localhost:${author}/world`;
  const sent = { method: 'POST', body: JSON.stringify({ name }) };
  const r = await fetch(at, sent);
  assert.equal(r.status, 200, `POST /world ${name}`);
  for (let i = 0; i < 200; i++) {
    await new Promise((res) => setTimeout(res, 300));
    const now = await fetch(at)
      .then((w) => w.json())
      .catch(() => undefined); // the port is unbound while it restarts
    if ((now as { current?: string } | undefined)?.current === name) return;
  }
  assert.fail(`the watcher did not come back on ${name}`);
}

/** Fill a controlled input and blur it, retrying until the value takes. React can remount between
 * `fill`'s select-all and its insert, so the insert lands on the restored draft and appends
 * ('600800' for '800' under load, loka-wfrgk.110). */
export async function fill(field: Locator, v: string) {
  for (let t = 0; t < 10; t++) {
    await field.fill(v);
    if ((await field.inputValue()) === v) return;
  }
}
