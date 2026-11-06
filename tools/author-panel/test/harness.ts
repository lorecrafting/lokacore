// The panel E2E's one Vite + bin/loka dev server pair and Chrome, on a copy of the toolbox showcase
// (panel.test.ts); its hooks attach to the importing test file, so the pair starts once per run.
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';

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

/** The panel with this layout kept, once the inspector's card has its form (the first compile and Vite's first optimise included). */
export async function open(layout: object, ready = 'Inspector'): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(
    (l) => localStorage.setItem('loka.editor.layout', l),
    JSON.stringify(layout),
  );
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
