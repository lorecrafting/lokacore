// The author panel in a browser (loka-wfrgk.41): the real panel, served by its Vite server against
// `bin/loka dev --watch` on the toolbox showcase, in stable Chrome (the runner image has it, as the
// Storybook jobs use). A new check: a test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
import assert from 'node:assert/strict';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import axe from 'axe-core';
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
let boot = 120_000; // the first compile and Vite's first optimise
const procs: ChildProcess[] = [];
const dir = mkdtempSync(join(tmpdir(), 'loka-panel-'));
before(async () => {
  const [author, panel, preview] = await Promise.all([free(), free(), free()]);
  const env = {
    ...process.env,
    LOKA_DEV_CARTRIDGE: join(dir, 'current.json'),
    LOKA_AUTHOR_PORT: `${author}`,
    LOKA_PANEL_PORT: `${panel}`,
    LOKA_PREVIEW_PORT: `${preview}`, // nothing serves it: the Book frame stays empty
  };
  const io: SpawnOptions = { env, detached: true, stdio: ['ignore', 'ignore', 'inherit'] };
  const showcase = join(ROOT, 'cartridges/toolbox_showcase');
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
async function open(layout: object): Promise<Page> {
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
  await page.locator('[aria-label="Inspector"] form').waitFor({ timeout: boot }); // any card's form
  return page;
}
const QUEST = { right: 280, selection: { kind: 'quest', key: 'carry_letter' } };

// Breaks: a card's field grid sizes its track to its content (an auto track, not grid-cols-1's
// minmax(0,1fr)), so a long text key pushes the card past the narrowest inspector (loka-wfrgk.40.1).
test('at a 280 px inspector the quest card fits its width', async () => {
  const page = await open(QUEST);
  const [scroll, client] = await page
    .locator('[aria-label="Inspector"]')
    .evaluate((e) => [e.scrollWidth, e.clientWidth]);
  assert.ok(client < 280, `inspector ${client} px wide: the kept 280 px layout was not applied`);
  assert.ok(scroll <= client, `card content ${scroll} px in a ${client} px inspector`);
});

// Breaks: a quest or dialogue opens the generic card (right.tsx's dispatch), a quest's own name is
// not a Book link (Quest.tsx's words), a dialogue's words list a field it lacks, a choice's then_failed row shows without a check (or hides
// with one), a known target is not drafted, or a choice's link
// takes a dialogue the story lacks (refuseLink not wired, or the refused text drafted and committed):
// the compile's UNRESOLVED_REFERENCE.
test('a quest and a dialogue open their cards; a link to no dialogue is refused', async () => {
  const quest = await open(QUEST);
  await quest.locator('[aria-label="quest card"]').waitFor({ timeout: boot });
  const book = quest.locator('[aria-label="quest card"] dl').getByRole('button', { name: 'Edit in Book' });
  assert.equal(await book.count(), 1); // its own name opens in the Book, never a text input
  await quest.close();
  const bess = await open({ right: 280, selection: { kind: 'dialogue', key: 'bess_talk' } });
  const rows = bess.locator('[aria-label="links"] input');
  await rows.first().waitFor({ timeout: boot });
  const labels = await rows.evaluateAll((es) => es.map((e) => e.getAttribute('aria-label')));
  // bess_talk.json: boast and lean carry a check, praise and insult none
  assert.deepEqual(labels, [
    'praise then',
    'insult then',
    'boast then',
    'boast then_failed',
    'lean then',
    'lean then_failed',
  ]);
  await bess.close();
  const page = await open({ right: 280, selection: { kind: 'dialogue', key: 'aldous_talk' } });
  const link = page.getByLabel('bounty then');
  await link.waitFor({ timeout: boot });
  const words = await page.locator('[aria-label="dialogue card"] dl dt').allTextContents();
  assert.deepEqual(words, ['prompt']); // aldous_talk.json has a prompt and no name of its own
  const saved = await link.inputValue();
  await link.fill('end'); // a known target is drafted
  assert.equal(await link.inputValue(), 'end');
  await link.fill(saved);
  await link.fill('nosuch');
  await page.getByText('no dialogue nosuch').waitFor({ timeout: boot });
  assert.equal(await link.getAttribute('aria-invalid'), 'true');
  await link.blur(); // a refused target was never drafted: the blur's commit leaves the saved link
  assert.notEqual(await link.inputValue(), 'nosuch');
  await page.close();
});

// Breaks: a control in the shell loses its accessible name, label or contrast (axe serious or
// critical; the Book frame is another page, tested by the Book's own axe runs).
test('the shell has no serious or critical axe violations', async () => {
  const page = await open(QUEST);
  await page.getByText(/^lint clean$|^\d+ lint notes?$/).waitFor(); // the Console's last arrival: axe reads the settled shell
  await page.addScriptTag({ content: axe.source });
  const found = await page.evaluate(() =>
    (globalThis as unknown as { axe: typeof axe }).axe
      .run({ exclude: [['iframe']] }, { iframes: false })
      .then((r) =>
        r.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          // a Radix id carries React's useId count (`_r_0_`), which any new hook before it shifts
          .map(
            (v) =>
              `${v.id}: ${v.nodes.map((n) => n.target.join(' ').replace(/_r_\w+?_/, '')).join(', ')}`,
          ),
      ),
  );
  // The baseline at this slice, open for the designer: the Project tab's contrast and the journal
  // outcomes' unlabelled key inputs. A fix removes its line; anything new fails.
  assert.deepEqual(found, [
    'color-contrast: #radix--trigger-project',
    'label: #root_journal_outcomes_deliver-key, #root_journal_outcomes_burn-key, #root_journal_outcomes_late-key',
  ]);
});

// Breaks: a reaction or a scripted action routed to the generic card (a command action away from it),
// its card failing to draw its form on the showcase's own files, its add menu losing a field the
// declared capabilities allow (the showcase declares policy and fact: `when` and `tip`; the refusal
// side is card.test's), or a scripted action's menu offering a command action's field.
test('a reaction and an action open their own cards', async () => {
  for (const [kind, key, field] of [
    ['reaction', 'letter_late', 'when'],
    ['action', 'fish', 'tip'],
  ]) {
    const page = await open({ selection: { kind, key } });
    await page.locator(`[aria-label="${kind} card"] form`).waitFor({ timeout: boot });
    const menu = page.getByLabel(`${kind} card`).getByLabel('Add a field').locator('option');
    const options = await menu.allTextContents();
    assert.ok(options.includes(field), `${kind} ${key} offers ${field}`);
    // a scripted action is never offered a command action's field (UNKNOWN_FIELD)
    assert.ok(!options.includes('accessibility'), `${kind} ${key} offers accessibility`);
    await page.close();
  }
  // a built-in command action keeps the generic card
  const barter = await open({ selection: { kind: 'action', key: 'barter' } });
  await barter.locator('[aria-label="Card"] form').waitFor({ timeout: boot });
  await barter.close();
});

// Breaks: a modal scene routed to the generic card, its treatment select missing or offering other
// than the schema's (none, reverie), or the generic form drawing treatment a second time.
test('a modal scene opens its card: one treatment picker, the schema’s', async () => {
  const page = await open({ selection: { kind: 'scene', key: 'letter_ash' } });
  const card = page.getByLabel('scene card');
  await card.locator('form').waitFor({ timeout: boot });
  assert.deepEqual(await card.getByLabel('treatment').locator('option').allTextContents(), [
    'none',
    'reverie',
  ]);
  await page.close();
});

/** The Flow graph in the left slot, warm: the first open compiles the story on the server (a cold open
 * measured 319 ms here), so the budget is read on a second. `took` reads the latest `flow:*` measures. */
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

// Breaks: the Flow graph's open (fetch, layout and commit) grows past BUDGET.flowOpen 300 on the
// showcase (rulings S3 Budgets), or a measure goes missing (NaN fails it).
test('the flow graph opens within 300 ms', async (t) => {
  const ms = await (await flow()).took(['flow:fetch', 'flow:layout', 'flow:commit']);
  t.diagnostic(`flow open ${ms.map(Math.round).join(' + ')} ms`);
  assert.ok(sum(ms) <= 300, `open ${ms.join(' + ')} ms`);
});

// Breaks: a filter's relayout grows past BUDGET.flowUpdate 100 (an open, under 300, still passes).
test('the flow graph refilters within 100 ms', async (t) => {
  const { page, left, took } = await flow();
  const before = await page.evaluate(
    () => performance.getEntriesByName('flow:commit').at(-1)!.startTime,
  );
  await left.getByLabel(/^~ Filters/).click();
  await page.getByRole('dialog').locator('button[aria-pressed]').first().click(); // a filter: a relayout (the showcase has no parts to fold)
  await page.waitForFunction(
    (t) => performance.getEntriesByName('flow:commit').at(-1)!.startTime > t,
    before,
  );
  const ms = await took(['flow:layout', 'flow:commit']);
  t.diagnostic(`flow refilter ${ms.map(Math.round).join(' + ')} ms`);
  assert.ok(sum(ms) <= 100, `refilter ${ms.join(' + ')} ms`);
});
