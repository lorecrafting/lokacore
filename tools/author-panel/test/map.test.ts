// The author panel's maps in a browser (split from panel.test.ts by area): the Flow graph, the story
// map and the open-in-editor asks, on harness.ts's Vite + bin/loka dev server pair and Chrome (its own
// boot). A new check: a test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { Page } from 'playwright';
import { boot, dir, open, QUEST } from './harness.ts';


/** The Flow graph in the left slot, warm: the first open compiles the story on the server (a cold open
 * measured 319 ms here), so the budget is read on a second, then on reloads. `took` reads the latest `flow:*` measures. */
async function flow() {
  const layout = { ...QUEST, leftOpen: true, map: 'flow' };
  const drawn = async (page: Page) => {
    const left = page.getByLabel('left column', { exact: true });
    await left.locator('footer', { hasText: / ms$/ }).waitFor();
    return left;
  };
  const cold = await open(layout);
  await drawn(cold); // the story compiled before the warm open's fetch
  await cold.close();
  const page = await open(layout);
  const left = await drawn(page);
  const took = (names: string[]) =>
    page.evaluate(
      (ns) => ns.map((n) => performance.getEntriesByName(n).at(-1)?.duration ?? NaN),
      names,
    );
  return { page, left, took };
}
const sum = (ms: number[]) => ms.reduce((a, b) => a + b);
// A budget holds when one of three measures is within it: load only adds time, so a slow machine
// passes on a quiet run while code past the budget fails all three (a missing measure, NaN, too).
async function within(t: TestContext, budget: number, measure: () => Promise<number[]>) {
  const seen: string[] = [];
  for (let run = 0; run < 3; run++) {
    const ms = await measure();
    seen.push(ms.map(Math.round).join(' + '));
    if (sum(ms) <= budget) return t.diagnostic(`${seen.join(', ')} ms`);
  }
  assert.fail(`over ${budget} ms each run: ${seen.join(', ')} ms`);
}

// Breaks: the Flow graph's open (fetch, layout and commit) grows past BUDGET.flowOpen 300 on the
// showcase (rulings S3 Budgets), or a measure goes missing (NaN fails it).
test('the flow graph opens within 300 ms', async (t) => {
  const { page, took } = await flow();
  let run = 0;
  await within(t, 300, async () => {
    if (run++) {
      await page.reload();
      await page
        .getByLabel('left column', { exact: true })
        .locator('footer', { hasText: / ms$/ })
        .waitFor();
    }
    return took(['flow:fetch', 'flow:layout', 'flow:commit']);
  });
});

// Breaks: a filter's relayout grows past BUDGET.flowUpdate 100 (an open, under 300, still passes).
test('the flow graph refilters within 100 ms', async (t) => {
  const { page, left, took } = await flow();
  await left.getByLabel(/^~ Filters/).click();
  const filter = page.getByRole('dialog').locator('button[aria-pressed]').first(); // a filter: a relayout (the showcase has no parts to fold)
  const relayout = async () => {
    const before = await page.evaluate(
      () => performance.getEntriesByName('flow:commit').at(-1)!.startTime,
    );
    await filter.click();
    await page.waitForFunction(
      (t) => performance.getEntriesByName('flow:commit').at(-1)!.startTime > t,
      before,
    );
  };
  // every run measures the filter turned on, then turns it off untimed
  await within(t, 100, async () => {
    await relayout();
    const ms = await took(['flow:layout', 'flow:commit']);
    await relayout();
    return ms;
  });
});

// Breaks: a refused compile's /story 500 shows no refusal in the map slot, or shows more than its first
// line (App.tsx useStory's failure rule, author.ts story's throw).
test('a refused /story shows its first line in the map slot', async () => {
  const page = await open(QUEST);
  const said = JSON.stringify({ text: {}, said: ['refused'], compiled: false }); // the watcher spoke
  await page.route('**/__author/events', (r) =>
    r.fulfill({ contentType: 'text/event-stream', body: `data: ${said}\n\n` }),
  );
  await page.route('**/__author/story', (r) =>
    r.fulfill({ status: 500, body: 'first line\nsecond line' }),
  );
  await page.reload();
  const slot = page.getByLabel('Map slot');
  await slot.getByText('first line').waitFor({ timeout: boot });
  assert.equal(await slot.getByText('second line').count(), 0);
  await page.close();
});

// Breaks: Cmd-E opens nothing for the selection (App.tsx's shortcut, loka-wfrgk.21).
test('Cmd-E asks to open the selected card’s file', async () => {
  const page = await open(QUEST);
  const sent: { key?: string }[] = [];
  await page.route(
    '**/__author/open',
    (r) => (sent.push(r.request().postDataJSON()), r.fulfill({ body: '{}' })),
  ); // no editor opens
  await page.keyboard.press('Control+e');
  for (let i = 0; i < 50 && !sent.length; i++) await page.waitForTimeout(100);
  assert.deepEqual(
    sent.map((s) => s.key),
    ['carry_letter'],
  );
  await page.close();
});

// Breaks (App.tsx open, loka-wfrgk.69): a story row's or a Flow chip's Alt-click asks /open with only a
// key, so the watcher, finding no source line for the key, opens nothing; or a plain click opens too.
test('Alt-click on a story row or a Flow chip asks to open its file, a plain click does not', async () => {
  for (const [map, node] of [
    ['story', (p: Page) => p.getByRole('treeitem', { name: 'barter, action', exact: true })],
    ['flow', (p: Page) => p.locator('[data-id$=":action/barter"]')],
  ] as const) {
    const page = await open({ ...QUEST, leftOpen: true, map });
    const sent: { file?: string }[] = [];
    await page.route('**/__author/open', (r) => (sent.push(r.request().postDataJSON()), r.fulfill({ body: '{}' })));
    await node(page).waitFor({ timeout: boot });
    await node(page).dispatchEvent('click'); // a Flow chip may sit outside the viewport
    await node(page).dispatchEvent('click', { altKey: true });
    for (let i = 0; i < 50 && !sent.length; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(500); // a plain click's open, if any, lands too
    assert.deepEqual(sent.map((s) => s.file), ['actions/barter.json'], map);
    await page.close();
  }
});

// Breaks (App.tsx useStory, loka-wfrgk.71): Bind not told the last compile's short refs, so it writes
// an unknown ref into outline.json, or refuses a known one.
test('Bind writes a short ref the last compile knows and refuses one it does not', async () => {
  const file = join(dir, 'showcase/outline.json');
  writeFileSync(file, '{ "parts": [{ "beats": [{ "n": 1 }] }] }\n');
  const nodes = () => JSON.parse(readFileSync(file, 'utf8')).parts[0].beats[0].nodes;
  const page = await open({ ...QUEST, leftOpen: true, map: 'story' });
  const ghost = page.getByRole('button', { name: 'Bind beat 1', exact: true });
  const bind = async (short: string) => {
    const told = page.evaluate(
      (s) =>
        new Promise<string>((r) => Object.assign(globalThis, { prompt: () => s, alert: (m: unknown) => r(String(m)) })),
      short,
    ); // the story map tells by alert (mapwire.ts alone): stubbed, never a real dialog
    await ghost.dispatchEvent('click');
    return told;
  };
  await ghost.waitFor({ state: 'attached', timeout: boot });
  assert.equal(await bind('nosuch/thing'), 'nosuch/thing is no definition in the last compile');
  assert.equal(nodes(), undefined);
  const told = bind('actions/barter').catch(() => 'nothing'); // a written bind tells nothing
  for (let t = 0; !nodes() && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual(nodes(), ['actions/barter']);
  rmSync(file);
  await page.close();
  assert.equal(await told, 'nothing');
});

// Breaks: the checkpoint name's refusal shows for a good name, or not for a bad one (sections.tsx).
test('a bad checkpoint name is refused, a good one is not', async () => {
  const page = await open({ ...QUEST, leftOpen: true, tab: 'project' });
  const name = page.getByLabel('Checkpoint name');
  const refusal = page.getByText('A name is up to 64');
  await name.fill('Bad Name');
  await refusal.waitFor();
  await name.fill('good_name');
  await refusal.waitFor({ state: 'detached' });
  await page.close();
});

// Breaks: a selected room's pill shows while its box already shows the whole key (loka-vduxr.73), or
// hides when zoomed out where the box shows none (mapsvg.tsx Drawing's Pills filter); or the footer
// loses its counts when nothing is refused (areamap.tsx's footer line). Map rulings, minimum zoom: level 0
// opens clipped at 0.25 (no M.floor in `fitted`), or a button or Cmd-wheel zoom out stops at 0.25 (no `least`).
test('level 0 opens whole, zooms out no further, and only a pill marks the selected disc', async () => {
  const page = await open({ selection: { kind: 'room', key: 'tollhouse' } });
  await page.emulateMedia({ reducedMotion: 'reduce' }); // each zoom lands at once
  const slot = page.getByLabel('Map slot');
  const pills = slot.locator('g.pointer-events-none text'),
    pill = pills.filter({ hasText: 'tollhouse' });
  const zoom = async (name: string, n = 12) => {
    for (let i = 0; i < n; i++) await slot.getByRole('button', { name }).click({ timeout: boot });
  };
  const seen = () =>
    slot.locator('svg [data-key]').evaluateAll((gs) => {
      // the width between room centres (zoom times cells); every room in the drawing
      const s = gs[0].closest('svg')!.getBoundingClientRect(),
        b = gs.map((g) => g.getBoundingClientRect()),
        x = b.map((r) => r.x + r.width / 2);
      return [
        Math.round(Math.max(...x) - Math.min(...x)),
        b.every(
          (r) => r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom,
        ),
      ];
    });
  await slot.getByText(/^\d+ rooms/).waitFor({ timeout: boot });
  const fit = await seen();
  assert.equal(fit[1], true); // whole, below 0.25: a disc, no label
  (await pill.waitFor(), assert.deepEqual(await pills.allTextContents(), ['tollhouse'])); // no other room is marked
  (await zoom('Zoom in'), await pill.waitFor({ state: 'detached' })); // 3: the box shows the whole key
  (await zoom('Zoom out'), assert.deepEqual(await seen(), fit));
  const b = (await slot.getByRole('group', { name: /^Area map/ }).boundingBox())!;
  (await zoom('Zoom in', 1),
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2),
    await page.keyboard.down('Meta'));
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 200); // Cmd-wheel out about the centre
  assert.deepEqual(await seen(), fit);
  await page.close();
});

