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
const server = spawn(
  'npx',
  ['storybook', 'dev', '-p', `${port}`, '--host', '127.0.0.1', '--ci', '--no-open'],
  {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, LOKA_NO_TIDEWAVE: '1' }, // the nightly run tests the Book, not the toolbar
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: true, // its own process group, stopped whole below
  },
);
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
  if (live.length < 2) throw new Error('fewer than two Live stories in the index');
  const browser = await chromium.launch();
  // The preview's own verdict per story: its first play or render error, else storyFinished's status.
  const watch = () => {
    const w = window as never as {
      __STORYBOOK_ADDONS_CHANNEL__?: any;
      live: Record<string, string>;
      current?: string;
      dbs: number;
    };
    w.live = {};
    // databases this page has open: expo-sqlite asks its worker to open and close each one
    w.dbs = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, m: { type?: string }, ...rest: never[]) {
      w.dbs += m?.type === 'open' ? 1 : m?.type === 'close' ? -1 : 0;
      return post.call(this, m, ...rest);
    };
    const hook = setInterval(() => {
      const channel = w.__STORYBOOK_ADDONS_CHANNEL__;
      if (!channel) return;
      clearInterval(hook);
      const fail = (why: string) => (e: { message?: string }) =>
        (w.live[w.current!] ??= `${why}: ${e.message}`);
      channel.on('storyRenderPhaseChanged', (e: { newPhase: string; storyId: string }) => {
        if (e.newPhase === 'preparing') w.current = e.storyId; // a torn-down story's late phases keep out
      });
      channel.on('playFunctionThrewException', fail('play'));
      channel.on('storyThrewException', fail('render'));
      channel.on('storyErrored', fail('errored'));
      channel.on(
        'storyFinished',
        (r: { storyId: string; status: string }) => (w.live[r.storyId] ??= r.status),
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
    // One context, so the second tab below shares this one's origin storage (loka-rqv).
    const context = await browser.newContext();
    await context.addInitScript(watch);
    const page = await context.newPage();
    await page.goto(`${url}/?path=/story/${a.id}`);
    const preview = (await (
      await page.waitForSelector('#storybook-preview-iframe')
    ).contentFrame())!;
    await verdict(preview, a.id); // a's own verdict is above
    await preview.evaluate(() => ((window as never as { kept: boolean }).kept = true));
    await page.click(`#${b.id}`);
    const switched = await verdict(preview, b.id);
    const { kept, dbs } = await preview.evaluate(() => {
      const w = window as never as { kept?: boolean; dbs: number };
      return { kept: w.kept, dbs: w.dbs };
    });
    report(
      `${a.id} then ${b.id}`,
      !kept
        ? 'iframe reloaded, switch not exercised'
        : dbs !== 1
          ? `${dbs} databases open after the switch, want 1`
          : switched,
    );
    // A second tab on the same origin while the first keeps its sqlite worker (loka-rqv).
    const second = await context.newPage();
    await second.goto(`${url}/iframe.html?id=${a.id}&viewMode=story`);
    report(`${a.id} in a second tab`, await verdict(second.mainFrame(), a.id));
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) process.kill(-server.pid!, 'SIGTERM'); // else keep its error
}
if (failed.length) {
  console.error(`storybook:live: ${failed.length} Live checks failed`);
  process.exit(1);
}
