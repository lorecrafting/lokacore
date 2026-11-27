// The builder smoke's harness (tests/build.ts): a watched copy of toolbox_showcase, the author preview
// and stable Chrome, started before the cases and stopped after them.
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';

const app = resolve(import.meta.dirname, '..');
const repo = resolve(app, '../..');
const tmp = mkdtempSync(join(tmpdir(), 'loka-build-'));
export const cart = join(tmp, 'cart');
const artifact = '.dev-cartridge/builder/current.json'; // under mobile/app: Metro serves only its own tree
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
  CI: undefined, // Metro does not watch files under CI (ci-info), so an edit would never reload the Book
  GITHUB_ACTIONS: undefined,
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
export const LONG = { timeout: 300_000 }; // the first page waits out Metro's cold bundle
let browser: Browser;
let said = 0; // when the watcher last printed: a compile, or a Hold's release publishing one

before(async () => {
  cpSync(join(repo, 'cartridges/toolbox_showcase'), cart, { recursive: true });
  let watching = false; // the watcher's line once its first compile wrote the artifact
  serve('bin/loka', ['dev', cart, '--watch'], repo).stdout.on('data', (b) => {
    said = performance.now();
    watching ||= `${b}`.includes('Watching ');
  });
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
  browser = await chromium.launch({ channel: 'chrome' });
});

after(async () => {
  await browser?.close();
  for (const s of servers)
    try {
      process.kill(-s.pid!, 'SIGTERM');
    } catch {} // already gone
  rmSync(tmp, { recursive: true, force: true });
  rmSync(join(app, artifact, '..'), { recursive: true, force: true });
});

export const file = (rel: string) => JSON.parse(readFileSync(join(cart, rel), 'utf8'));
/** The Book at `width` with Build on, its first room drawn. */
export async function book(width: number) {
  // A case's last write compiles (or its Hold releases on close) after the case: let that reload
  // land on no page, not on this one mid-case.
  const asked = performance.now() + 1500; // a write's compile prints within this
  await wait(() => performance.now() > asked && performance.now() - said > 2500, 'a quiet watcher');
  const p = await browser.newPage({ viewport: { width, height: 800 } });
  await p.goto(`${url}?dev=1`, LONG);
  await p.getByRole('switch', { name: 'Build' }).click(LONG);
  return p;
}

export const sheet = (p: Page) => p.getByRole('dialog').last();
export const undo = (p: Page) => p.getByRole('button', { name: 'Undo', exact: true });
/** Opens the palette on `words`, then the row named `row` (the top row when none). */
export async function palette(p: Page, words: string, row?: RegExp) {
  await p.keyboard.press('Meta+k');
  await p.getByRole('textbox', { name: 'Type a command, a key or words' }).fill(words);
  if (row) await p.getByRole('button', { name: row }).first().click();
  else await p.keyboard.press('Enter');
}
/** Waits up to 15 s for `ok`: a write reaches the disk after the server's compile. */
export async function until(ok: () => boolean, what: string) {
  for (let t = 0; !ok(); t++) {
    assert.ok(t < 150, what);
    await new Promise((r) => setTimeout(r, 100));
  }
}
