// npm run storybook:live (Beads loka-bhb batch 4): the Live stories run only on the dev server (their
// sqlite worker needs its isolation headers), so this starts one on a free port, opens every Live
// story in headless Chromium, fails on a render or play error, and stops the server.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const port = await new Promise<number>((found) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address() as { port: number };
    probe.close(() => found(port));
  });
});
const url = `http://localhost:${port}`;
const server = spawn('npx', ['storybook', 'dev', '-p', `${port}`, '--ci', '--no-open'], {
  cwd: new URL('..', import.meta.url),
  stdio: ['ignore', 'ignore', 'inherit'],
  detached: true, // its own process group, stopped whole below
});
const failed: string[] = [];
try {
  let index: { entries: Record<string, { id: string; title: string; type: string }> } | undefined;
  for (const start = Date.now(); !index; await new Promise((r) => setTimeout(r, 500))) {
    if (server.exitCode !== null) throw new Error(`storybook dev exited ${server.exitCode}`);
    if (Date.now() - start > 120_000) throw new Error('storybook dev did not start in 120 s');
    index = await fetch(`${url}/index.json`)
      .then((r) => (r.ok ? r.json() : undefined))
      .catch(() => undefined);
  }
  const live = Object.values(index.entries).filter((e) => e.title === 'Live' && e.type === 'story');
  if (live.length === 0) throw new Error('no Live stories in the index');
  const browser = await chromium.launch();
  try {
    for (const { id } of live) {
      const page = await browser.newPage();
      // The preview's own verdict: a play or render error, else storyFinished's status.
      await page.addInitScript(() => {
        const w = window as never as { __STORYBOOK_ADDONS_CHANNEL__?: any; live?: string };
        const hook = setInterval(() => {
          const channel = w.__STORYBOOK_ADDONS_CHANNEL__;
          if (!channel) return;
          clearInterval(hook);
          const fail = (why: string) => (e: { message?: string }) =>
            (w.live = `${why}: ${e.message}`);
          channel.on('playFunctionThrewException', fail('play'));
          channel.on('storyThrewException', fail('render'));
          channel.on('storyErrored', fail('errored'));
          channel.on('storyFinished', (r: { status: string }) => (w.live ??= r.status));
        }, 10);
      });
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`);
      const verdict = await page
        .waitForFunction(() => (window as never as { live?: string }).live, undefined, {
          timeout: 60_000,
        })
        .then((h) => h.jsonValue())
        .catch((e: Error) => `timed out: ${e.message.split('\n')[0]}`);
      console.log(`${verdict === 'success' ? 'ok  ' : 'FAIL'} ${id} ${verdict}`);
      if (verdict !== 'success') failed.push(id);
      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  process.kill(-server.pid!, 'SIGTERM');
}
if (failed.length) {
  console.error(`storybook:live: ${failed.length} Live stories failed`);
  process.exit(1);
}
