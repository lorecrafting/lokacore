// npm run storybook:live (Beads loka-bhb batch 4): the Live stories run only on the dev server (their
// sqlite worker needs its isolation headers), so this starts one on a free port, opens every Live
// story in headless Chromium, fails on a render or play error, and stops the server.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, type Frame } from 'playwright';

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
  // The preview's own verdict per story: storyFinished's status, with the last play or render error.
  const watch = () => {
    const w = window as never as {
      __STORYBOOK_ADDONS_CHANNEL__?: any;
      live?: object;
      why?: string;
    };
    w.live = {};
    const hook = setInterval(() => {
      const channel = w.__STORYBOOK_ADDONS_CHANNEL__;
      if (!channel) return;
      clearInterval(hook);
      const fail = (why: string) => (e: { message?: string }) => (w.why = `${why}: ${e.message}`);
      channel.on('playFunctionThrewException', fail('play'));
      channel.on('storyThrewException', fail('render'));
      channel.on('storyErrored', fail('errored'));
      channel.on('storyFinished', (r: { storyId: string; status: string }) =>
        Object.assign(w.live!, {
          [r.storyId]: r.status === 'success' ? 'success' : (w.why ?? r.status),
        }),
      );
    }, 10);
  };
  const verdict = (frame: Frame, id: string) =>
    frame
      .waitForFunction(
        (id) => (window as never as { live?: Record<string, string> }).live?.[id],
        id,
        {
          timeout: 60_000,
        },
      )
      .then((h) => h.jsonValue() as Promise<string>)
      .catch((e: Error) => `timed out: ${e.message.split('\n')[0]}`);
  const report = (id: string, verdict: string) => {
    console.log(`${verdict === 'success' ? 'ok  ' : 'FAIL'} ${id} ${verdict}`);
    if (verdict !== 'success') failed.push(id);
  };
  try {
    for (const { id } of live) {
      const page = await browser.newPage();
      await page.addInitScript(watch);
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`);
      report(id, await verdict(page.mainFrame(), id));
      await page.close();
    }
    // loka-0qz: a sidebar switch keeps the preview iframe, its sqlite worker and open databases.
    const [a, b] = live as [(typeof live)[0], (typeof live)[0]];
    const page = await browser.newPage();
    await page.addInitScript(watch);
    await page.goto(`${url}/?path=/story/${a.id}`);
    const preview = (await (
      await page.waitForSelector('#storybook-preview-iframe')
    ).contentFrame())!;
    await verdict(preview, a.id); // a's own verdict is above
    await preview.evaluate(() => ((window as never as { kept: boolean }).kept = true));
    await page.click(`#${b.id}`);
    const switched = await verdict(preview, b.id);
    const kept = await preview.evaluate(() => (window as never as { kept?: boolean }).kept);
    report(`${a.id} then ${b.id}`, kept ? switched : 'iframe reloaded, switch not exercised');
    await page.close();
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) process.kill(-server.pid!, 'SIGTERM'); // else keep its error
}
if (failed.length) {
  console.error(`storybook:live: ${failed.length} Live stories failed`);
  process.exit(1);
}
