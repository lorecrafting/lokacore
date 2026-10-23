// npm run stories:sheet: every story at 390 px in Reading size Standard and Max, light and dark, on
// one local page, .walkthrough/stories/index.html (gitignored). It starts its own Storybook on a free
// port, opens one preview per combination and switches stories in place, which is far faster
// than a page load per story. Live stories (dev-server sqlite) stay out.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createServer } from 'node:net';
import { chromium, type Page } from 'playwright';
import { fileURLToPath } from 'node:url';

type W = {
  __STORYBOOK_ADDONS_CHANNEL__: { emit(e: string, a: object): void };
  done?: Record<string, string>;
};
const combos = ['Standard:light', 'Standard:dark', 'Max:light', 'Max:dark'];
const out = fileURLToPath(new URL('../.walkthrough/stories/', import.meta.url));
const port = await new Promise<number>((found) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address() as { port: number };
    probe.close(() => found(port));
  });
});
const root = realpathSync(fileURLToPath(new URL('../../..', import.meta.url)));
const live = process.env.LOKA_SESSION_DIR ?? `${homedir()}/dev/lokacore-session`;
// Its Vite cache rebuild would reload the owner's Storybook on 6006.
if (existsSync(live) && realpathSync(live) === root)
  throw new Error('stories:sheet: not in the live session worktree; run it from your own');
const url = `http://localhost:${port}`;
const server = spawn(
  'npx',
  ['storybook', 'dev', '-p', `${port}`, '--host', '127.0.0.1', '--ci', '--no-open'],
  { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'ignore', 'inherit'], detached: true },
);
const stop = () => server.exitCode === null && process.kill(-server.pid!, 'SIGTERM');
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => (stop(), process.exit(130)));
const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const started = Date.now();
try {
  let index:
    | { entries: Record<string, { id: string; title: string; name: string; type: string }> }
    | undefined;
  for (const start = Date.now(); !index; await new Promise((r) => setTimeout(r, 500))) {
    if (server.exitCode !== null) throw new Error(`storybook dev exited ${server.exitCode}`);
    if (Date.now() - start > 120_000) throw new Error('storybook dev did not start in 120 s');
    index = await fetch(`${url}/index.json`)
      .then((r) => (r.ok ? r.json() : undefined))
      .catch(() => undefined);
  }
  const stories = Object.values(index.entries).filter(
    (e) => e.type === 'story' && e.title !== 'Live',
  );
  rmSync(out, { recursive: true, force: true });
  const browser = await chromium.launch();
  // The preview's verdict per story: storyFinished's status, or the first error.
  const watch = () => {
    const w = window as never as {
      __STORYBOOK_ADDONS_CHANNEL__?: any;
      done: Record<string, string>;
      current?: string;
    };
    w.done = {};
    const hook = setInterval(() => {
      const channel = w.__STORYBOOK_ADDONS_CHANNEL__;
      if (!channel) return;
      clearInterval(hook);
      for (const e of ['storyErrored', 'storyThrewException', 'playFunctionThrewException'])
        channel.on(e, (x: { message?: string }) => (w.done[w.current!] ??= `${e}: ${x?.message}`));
      channel.on('storyRenderPhaseChanged', (e: { newPhase: string; storyId: string }) => {
        if (e.newPhase === 'preparing') w.current = e.storyId;
      });
      channel.on(
        'storyFinished',
        (r: { storyId: string; status: string }) => (w.done[r.storyId] ??= r.status),
      );
    }, 10);
  };
  const verdicts = new Map<string, string>(); // `${combo} ${id}` -> not success
  const shoot = async (combo: string) => {
    const [reading, palette] = combo.split(':');
    mkdirSync(`${out}${combo.replace(':', '-')}`, { recursive: true });
    const page: Page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(watch);
    for (const [i, { id }] of stories.entries()) {
      if (i === 0)
        await page.goto(
          `${url}/iframe.html?id=${id}&globals=palette:${palette};reading:${reading}&viewMode=story`,
        );
      else
        await page.evaluate(
          (storyId) =>
            (window as never as W).__STORYBOOK_ADDONS_CHANNEL__.emit('setCurrentStory', {
              storyId,
              viewMode: 'story',
            }),
          id,
        );
      const verdict = await page
        .waitForFunction((id) => (window as never as W).done?.[id], id, { timeout: 30_000 })
        .then((h) => h.jsonValue() as Promise<string>)
        .catch(() => 'timed out');
      if (verdict !== 'success') verdicts.set(`${combo} ${id}`, verdict);
      await page.evaluate(() => document.fonts.ready);
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({
        path: `${out}${combo.replace(':', '-')}/${id}.png`,
        clip: { x: 0, y: 0, width: 390, height: Math.min(h, 2400) },
        fullPage: true,
      });
    }
    await page.close();
  };
  await Promise.all(combos.map(shoot));
  await browser.close();

  // The globals must reach the stories: a palette or Reading size that does not apply leaves
  // the first text story the same picture in every column.
  const shot = (combo: string, id: string) =>
    readFileSync(`${out}${combo.replace(':', '-')}/${id}.png`);
  const probe = stories.find((s) => s.id.startsWith('book-entityline'))?.id ?? stories[0]!.id;
  if (shot('Standard:light', probe).equals(shot('Standard:dark', probe)))
    throw new Error(`${probe}: light and dark identical`);
  if (shot('Standard:light', probe).equals(shot('Max:light', probe)))
    throw new Error(`${probe}: Standard and Max identical`);

  const rows = stories.map(({ id, title, name }) => {
    const cells = combos.map((c) => {
      const v = verdicts.get(`${c} ${id}`);
      return `<td${v ? ' class="bad"' : ''}><img loading="lazy" src="${c.replace(':', '-')}/${id}.png" alt="${escape(c)}">${v ? `<br>${escape(v)}` : ''}</td>`;
    });
    return `<tr><th>${escape(title)}<br><small>${escape(name)}</small></th>${cells.join('')}</tr>`;
  });
  writeFileSync(
    `${out}index.html`,
    `<!doctype html><meta charset="utf-8"><title>Story sheet</title>
<style>
body{font:13px system-ui;margin:16px;background:#f4f1ea;color:#222}
table{border-collapse:collapse}th{text-align:left;vertical-align:top;width:180px;position:sticky;left:0;background:#f4f1ea}
thead th{position:sticky;top:0;z-index:1}td{vertical-align:top;padding:4px}
td img{width:200px;border:1px solid #999;cursor:zoom-in;background:#ccc}.bad{outline:3px solid #c00}
#zoom{position:fixed;inset:0;background:#000c;display:none;justify-content:center;align-items:flex-start;overflow:auto;cursor:zoom-out}
#zoom img{width:390px}
</style>
<h1>Story sheet</h1>
<p>Generated ${new Date().toISOString()} by <code>npm run stories:sheet</code>: ${stories.length} stories at 390 px. Click to enlarge.</p>
<table><thead><tr><th>Story</th>${combos.map((c) => `<th>${c.replace(':', ' · ')}</th>`).join('')}</tr></thead>
${rows.join('\n')}</table>
<div id="zoom" onclick="this.style.display='none'"><img></div>
<script>document.querySelectorAll('td img').forEach(i=>i.onclick=()=>{const z=document.getElementById('zoom');z.firstChild.src=i.src;z.style.display='flex'})</script>
`,
  );
  console.log(
    `story sheet: mobile/app/.walkthrough/stories/index.html (${stories.length} stories × ${combos.length}, ${verdicts.size} not success, ${Math.round((Date.now() - started) / 1000)} s)`,
  );
} finally {
  stop();
}
