// The author panel in a browser (loka-wfrgk.41): the real panel, served by its Vite server against
// `bin/loka dev --watch` on the toolbox showcase, in stable Chrome (the runner image has it, as the
// Storybook jobs use). A new check: a test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
// size: allow 644, every panel E2E shares this file's one Vite + bin/loka dev server pair and Chrome
import assert from 'node:assert/strict';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test, type TestContext } from 'node:test';
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

let browser: Browser, url: string, author: number;
let boot = 120_000; // the first compile and Vite's first optimise
const procs: ChildProcess[] = [];
const dir = mkdtempSync(join(tmpdir(), 'loka-panel-'));
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
async function open(layout: object, ready = 'Inspector'): Promise<Page> {
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

// Breaks: the inspector column does not scroll (no overflow on the card's box, or a box that is not
// positioned, which its absolute sr-only labels escape), so a tall room card stretches the page (loka-wfrgk.44);
// or the tall card squeezes the console below it to a sliver.
test('a tall room card scrolls inside the inspector, not the page', async () => {
  const page = await open({ selection: { kind: 'room', key: 'tollhouse' } });
  const [page_, box] = await page
    .locator('[aria-label="Inspector"]')
    .evaluate((e) => [
      e.ownerDocument.scrollingElement!.scrollHeight - e.ownerDocument.defaultView!.innerHeight,
      e.scrollHeight - e.clientHeight,
    ]);
  assert.equal(page_, 0, 'the page scrolls');
  assert.ok(box > 0, 'the room card fits: this test no longer opens a tall card');
  assert.ok(
    (await page.getByLabel('Console').boundingBox())!.height >= 100,
    'the console is squeezed to a sliver',
  );
});

// Breaks: clicking the minutes field leaves its text, so typing appends (60 then 600 → 60600; loka-wfrgk.55).
test('typing in the game minutes field replaces its text', async () => {
  const page = await open(QUEST);
  await page.getByRole('tab', { name: 'Project' }).click();
  const field = page.getByLabel('Game minutes');
  await field.click();
  await page.keyboard.type('5');
  assert.equal(await field.inputValue(), '5');
});

// Breaks: the palette asks /find on every keystroke, not once the typing pauses (loka-vduxr.67), or
// drops its answer (palette.tsx useFound).
test('the palette asks /find once per pause in the typing', async () => {
  const page = await open(QUEST);
  const asked: string[] = [];
  page.on('request', (r) => void (r.url().includes('/__author/find?') && asked.push(r.url())));
  const hit = { at: 'text.json:1', text: '"quest.zz.name": "a stubbed carry line",' }; // its words become a row
  await page.route('**/__author/find?*', (r) => r.fulfill({ json: { hits: [hit] } }));
  await page.keyboard.press('Control+k');
  await page.getByLabel('Find a key, a ~ or a command').pressSequentially('carry', { delay: 10 }); // keys well inside the 150 ms pause, even under load
  await page.waitForTimeout(600);
  assert.deepEqual(
    asked.map((u) => new URL(u).searchParams.get('q')),
    ['carry'],
  );
  await page.getByText('a stubbed carry line').waitFor();
  await page.close();
});

// Breaks: a quest or dialogue opens the generic card (right.tsx's dispatch), a quest's own name is
// not a Book link (Quest.tsx's words), a dialogue's words list a field it lacks, a choice's then_failed row shows without a check (or hides
// with one), a known target is not drafted, or a choice's link
// takes a dialogue the story lacks (refuseLink not wired, or the refused text drafted and committed):
// the compile's UNRESOLVED_REFERENCE.
test('a quest and a dialogue open their cards; a link to no dialogue is refused', async () => {
  const quest = await open(QUEST);
  await quest.locator('[aria-label="quest card"]').waitFor({ timeout: boot });
  const book = quest
    .locator('[aria-label="quest card"] dl')
    .getByRole('button', { name: 'Edit in Book' });
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
  // the tree, not the generic form: one folded block per choice; its key is never renamed
  const tree = await bess.locator('[aria-label="choices"] summary').allTextContents();
  assert.deepEqual(tree, ['praise', 'insult', 'boast', 'lean']);
  const boast = bess.locator('[aria-label="choice boast"]');
  await boast.locator('summary').click();
  // its words keep the form's widgets: Edit in Book, never a text input (fields.tsx TextKey)
  await boast.getByRole('button', { name: 'Edit in Book' }).first().waitFor({ timeout: boot });
  // bess_talk.json's boast: check and steps are removable rows; label and narration, its words, never
  const shown = await boast.locator('span.flex-1').allTextContents();
  assert.deepEqual(shown.sort(), ['check', 'steps']);
  await boast.getByRole('button', { name: 'Rename' }).click();
  await boast.getByText("a choice's key is its id").waitFor({ timeout: boot });
  await bess.close();
  const page = await open({ right: 280, selection: { kind: 'dialogue', key: 'aldous_talk' } });
  const link = page.getByLabel('bounty then');
  await link.waitFor({ timeout: boot });
  const words = await page.locator('[aria-label="dialogue card"] dl dt').allTextContents();
  assert.deepEqual(words, ['prompt']); // aldous_talk.json has a prompt and no name of its own
  const saved = await link.inputValue();
  assert.equal(await page.getByRole('button', { name: 'Add choice' }).isDisabled(), true); // no key yet
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

// Breaks: a choice whose link leads to a nested set (entry: false, mechanics.md:504) loses the
// set's read-only prompt and labels, folds a second level, or a link inside it no longer opens
// that dialogue's own card.
test('a link to a nested set shows its prompt and labels and opens its card', async () => {
  const page = await open({ right: 280, selection: { kind: 'dialogue', key: 'aldous_talk' } });
  await page.route('**/__author/change', (r) => r.abort()); // nothing drafted here is written
  await page.route('**/__author/source?file=*aldous_lesson*', async (r) => {
    const s = await (await r.fetch()).json();
    const doc = JSON.parse(s.bytes);
    doc.entry = false;
    doc.choices.learn.then = 'aldous_yard'; // a second level: its button, never a fold
    doc.choices.leave = { label: 'k.leave', then: 'end' }; // the talk ends: no button
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...s, bytes: JSON.stringify(doc) }) });
  });
  const bounty = page.locator('[aria-label="choice bounty"]');
  await bounty.locator('summary').click();
  await page.getByLabel('bounty then').fill('aldous_lesson');
  const set = bounty.locator('[aria-label="nested aldous_lesson"]');
  await set.waitFor({ timeout: boot });
  const keys = await set.locator('code').allTextContents();
  assert.deepEqual(keys.slice(0, 2), ['dialogue.aldous_lesson.prompt', 'dialogue.aldous_lesson.learn']);
  assert.equal(await page.locator('[aria-label^="nested "]').count(), 1);
  const opens = await set.getByRole('button').allTextContents();
  assert.deepEqual(opens, ['Open aldous_lesson', 'Open aldous_yard']);
  await set.getByRole('button', { name: 'Open aldous_yard' }).click();
  const title = page.locator('[aria-label="Inspector"]').getByText('aldous_yard', { exact: true });
  await title.waitFor({ timeout: boot }); // the inspector's title is the opened dialogue's key
  await page.unrouteAll({ behavior: 'ignoreErrors' }); // its own card reads the source too
  await page.close();
});

// Breaks: a dialogue already broken refuses every edit, its fix too, for the break it had
// (Dialogue.tsx useGated); the review's record: praise holds receive and hand_over, insult a
// then_failed with no check.
test('a dialogue already broken takes the edit that fixes it', async () => {
  const page = await open({ right: 280, selection: { kind: 'dialogue', key: 'bess_talk' } });
  await page.route('**/__author/change', (r) => r.abort());
  await page.route('**/__author/source?file=*bess_talk*', async (r) => {
    const s = await (await r.fetch()).json();
    const doc = JSON.parse(s.bytes);
    Object.assign(doc.choices.praise, { receive: { item: 'x' }, hand_over: { item: 'x' } });
    doc.choices.insult.then_failed = 'end';
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...s, bytes: JSON.stringify(doc) }) });
  });
  await page.reload(); // the card read its source before the route
  const praise = page.locator('[aria-label="choice praise"]');
  await praise.locator('summary').click();
  const row = praise.locator('span.flex-1').getByText('hand_over', { exact: true });
  await row.locator('..').getByRole('button', { name: 'Remove' }).click();
  await row.waitFor({ state: 'detached', timeout: boot }); // the old gate kept it, refused
  assert.equal(await page.getByText('then_failed needs a check').count(), 0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close();
});

// Breaks: a nested set read late, after its link moved to another dialogue, shows under that one.
test("a slow read of a link's old target never shows under its new one", async () => {
  const page = await open({ right: 280, selection: { kind: 'dialogue', key: 'aldous_talk' } });
  await page.route('**/__author/change', (r) => r.abort());
  let sent!: () => void;
  const late = new Promise<void>((done) => (sent = done));
  await page.route('**/__author/source?file=*aldous_lesson*', async (r) => {
    const s = await (await r.fetch()).json();
    await new Promise((t) => setTimeout(t, 1500)); // lands after aldous_yard's read
    const bytes = JSON.stringify({ ...JSON.parse(s.bytes), entry: false });
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...s, bytes }) });
    sent();
  });
  await page.locator('[aria-label="choice bounty"] summary').click();
  const link = page.getByLabel('bounty then');
  await link.fill('aldous_lesson');
  await link.fill('aldous_yard');
  await late;
  await page.waitForTimeout(300); // the late read rendered, if it would
  assert.equal(await page.locator('[aria-label^="nested "]').count(), 0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
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
  assert.deepEqual(found.sort(), [
    'color-contrast: #radix--trigger-project',
    'label: #root_journal_outcomes_deliver-key, #root_journal_outcomes_burn-key, #root_journal_outcomes_late-key',
  ]);
});

// Breaks: the NPC card loses its blocks (a field not claimed, the claim lost to hidden(), a block not
// registered), so hp, attack and the schedule fall back to the generic rows; an hour's room is
// free text again, not the room picker; a second block write posts from the first's stale card
// (rjsf keeps its first formContext: the server refuses it, Changed outside); a refused hour is
// written or a moved one is not; or the fight rows' reason is hidden, or offered beside hp.
test('an NPC card draws its Combat and Schedule blocks', async () => {
  const page = await open({ right: 420, selection: { kind: 'npc', key: 'warden' } });
  for (const f of ['hp', 'attack'])
    await page.locator(`[aria-label="Combat ${f}"]`).waitFor({ timeout: boot });
  const schedule = page.locator('fieldset[aria-label="Schedule"]');
  const hours = schedule.getByRole('textbox', { name: /^hour / });
  const read = await hours.all();
  assert.deepEqual(await Promise.all(read.map((h) => h.inputValue())), ['13', '14']);
  const room = schedule.locator('input[id$="_14"]'); // hour 14's lone room
  const options = await page.locator(`datalist#${await room.getAttribute('id')}-keys option`).all();
  const offered = await Promise.all(options.map((o) => o.getAttribute('value')));
  assert.ok(offered.includes('warden_gate'), `rooms offered: ${offered}`);
  const add = schedule.getByRole('button', { name: 'Add hour' });
  const reread = page.waitForResponse((r) => r.url().includes('/__author/schema/')); // the card's reload after the write
  await add.click();
  await (await reread).finished();
  await page.waitForTimeout(50); // the reload rendered
  const again = page.waitForResponse((r) => r.url().includes('/__author/schema/'));
  await add.click();
  const file = join(dir, 'showcase/areas/low_wardle/npcs/warden.json');
  const written = () => Object.keys(JSON.parse(readFileSync(file, 'utf8')).daily_schedule);
  for (let t = 0; written().length < 4 && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual(written(), ['0', '1', '13', '14']);
  await (await again).finished();
  await page.waitForTimeout(50);
  const hour = schedule.getByRole('textbox', { name: 'hour 14' });
  await hour.fill('99');
  await hour.blur();
  await schedule.getByText('an hour is below 24').waitFor();
  await hour.fill('15');
  await hour.blur();
  for (let t = 0; !written().includes('15') && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual(written(), ['0', '1', '13', '15']);
  // Break: the hour field's blur reaches the card's onBlur commit too (Schedule.tsx stopPropagation),
  // whose stale `was` the server refuses: Changed outside, and Undo cleared.
  await page.waitForTimeout(1500);
  assert.equal(await page.getByText('Changed outside').count(), 0);
  assert.ok(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled());
  await page.route('**/__author/numbers', (r) =>
    r.fulfill({ json: { fights: { why: 'no world' } } }),
  );
  await page
    .locator('[aria-label="Combat attack"]')
    .getByRole('button', { name: 'Run fights' })
    .click();
  await page.locator('[aria-label="Combat attack"]').getByText('no world').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Run fights' }).count(), 1); // not on hp
  await page.close();
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
    if (kind === 'action') {
      // Break: an added prose field is only revealed, never written (loka-wfrgk.24): it writes its key `~`
      await page.getByLabel(`${kind} card`).getByLabel('Add a field').selectOption(field);
      const tip = () => JSON.parse(readFileSync(join(dir, 'showcase/actions/fish.json'), 'utf8')).tip;
      for (let t = 0; tip() === undefined && t < 50; t++) await page.waitForTimeout(100);
      assert.deepEqual(tip(), { prose: '~' });
    }
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
      await page.getByLabel('left column', { exact: true }).locator('footer', { hasText: / ms$/ }).waitFor();
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
    const before = await page.evaluate(() => performance.getEntriesByName('flow:commit').at(-1)!.startTime);
    await filter.click();
    await page.waitForFunction((t) => performance.getEntriesByName('flow:commit').at(-1)!.startTime > t, before);
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
  const pills = slot.locator('g.pointer-events-none text'), pill = pills.filter({ hasText: 'tollhouse' });
  const zoom = async (name: string, n = 12) => { for (let i = 0; i < n; i++) await slot.getByRole('button', { name }).click({ timeout: boot }); };
  const seen = () => slot.locator('svg [data-key]').evaluateAll((gs) => { // the width between room centres (zoom times cells); every room in the drawing
    const s = gs[0].closest('svg')!.getBoundingClientRect(), b = gs.map((g) => g.getBoundingClientRect()), x = b.map((r) => r.x + r.width / 2);
    return [Math.round(Math.max(...x) - Math.min(...x)), b.every((r) => r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom)];
  });
  await slot.getByText(/^\d+ rooms/).waitFor({ timeout: boot });
  const fit = await seen(); assert.equal(fit[1], true); // whole, below 0.25: a disc, no label
  await pill.waitFor(), assert.deepEqual(await pills.allTextContents(), ['tollhouse']); // no other room is marked
  await zoom('Zoom in'), await pill.waitFor({ state: 'detached' }); // 3: the box shows the whole key
  await zoom('Zoom out'), assert.deepEqual(await seen(), fit);
  const b = (await slot.getByRole('group', { name: /^Area map/ }).boundingBox())!;
  await zoom('Zoom in', 1), await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2), await page.keyboard.down('Meta');
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 200); // Cmd-wheel out about the centre
  assert.deepEqual(await seen(), fit);
  await page.close();
});

// Last: it switches the world. Breaks: a `.scene` dialogue routed to no card or the generic one, a
// value line without its picker or its verb's keys, a words line without its Book edit, an unknown
// key or the line's own value sent, Enter not sending, a refusal or a write's Undo not shown, or a
// modal scene's treatment shown as none, or then: offering an unlinkable dialogue (Scene.tsx's
// context.unlinkable dropped).
test('a .scene dialogue opens its text card: a picker per value line, words to the Book', async () => {
  appendFileSync(join(dir, 'identity_sampler/scenes/stranger_talk.scene'), '  then: end\n'); // line 7
  const world = { method: 'POST', body: JSON.stringify({ name: 'identity_sampler' }) };
  assert.equal((await fetch(`http://localhost:${author}/world`, world)).status, 200);
  const page = await open({ selection: { kind: 'dialogue', key: 'stranger_talk' } }, 'line 1 npc');
  const npc = page.getByLabel('line 1 npc');
  assert.equal(await npc.inputValue(), 'stranger');
  const card = page.getByLabel('scene card');
  assert.equal(await card.getByRole('button', { name: 'Edit in Book' }).count(), 2); // lines 3, 6
  const sent: string[] = [];
  page.on('request', (r) => void (r.url().includes('/set') && sent.push(r.url())));
  await npc.fill('nobody');
  await npc.press('Enter');
  await card.getByText('no npc nobody').waitFor();
  await npc.blur();
  assert.deepEqual(sent, []); // refused here, never sent
  const keys = page.locator('#scene-1-keys option');
  assert.deepEqual(await keys.evaluateAll((os) => os.map((o) => o.getAttribute('value'))), [
    'guard',
    'stranger',
  ]); // npc: an NPC key, never a dialogue or end
  assert.equal(await card.locator('li label > span').first().textContent(), 'npc:');
  await npc.fill('stranger');
  await npc.blur(); // the line's own value: nothing to send
  // /set answered here, never by the repo's file: first a refusal, then a write
  const posted: unknown[] = [];
  const answers = [
    { status: 400, json: 'refused by the server' },
    { status: 200, json: { id: 'u1' } },
  ];
  await page.route('**/__author/set', (r) => {
    posted.push(r.request().postDataJSON());
    return r.fulfill(answers.shift()!);
  });
  const undo = card.getByRole('button', { name: 'Undo' });
  await npc.fill('guard');
  await npc.press('Enter'); // Enter sends
  await card.getByText('refused by the server').waitFor();
  assert.equal(await undo.isEnabled(), false);
  await npc.focus();
  await npc.blur();
  await card.getByText('refused by the server').waitFor({ state: 'detached' });
  assert.equal(await undo.isEnabled(), true); // a write's id is the card's Undo
  const one = { file: 'scenes/stranger_talk.scene', line: 1, was: 'npc: stranger', value: 'guard' };
  assert.deepEqual(posted, [one, one]);
  // then: offers no dialogue the story names unlinkable (a keyword one, dialogue_links.ex:387-394)
  await page.route('**/__author/story', async (r) => {
    const res = await r.fetch();
    r.fulfill({ response: res, json: { ...(await res.json()), unlinkable: { stranger_talk: 'keyword' } } });
  });
  await page.reload();
  const then = page.locator('#scene-7-keys option');
  await page.getByLabel('line 7 then').waitFor();
  assert.deepEqual(await then.evaluateAll((os) => os.map((o) => o.getAttribute('value'))), ['end']);
  await page.close();
  const sampler = { method: 'POST', body: JSON.stringify({ name: 'scene_sampler' }) };
  assert.equal((await fetch(`http://localhost:${author}/world`, sampler)).status, 200);
  const rope = await open({ selection: { kind: 'scene', key: 'rope_reverie' } });
  assert.equal(await rope.getByLabel('treatment').inputValue(), 'reverie'); // the file's, not none
  await rope.close();
});

// Breaks: an edit elsewhere in a status card writes its integer `duration` as the other anyOf
// branch's `permanent` (loka-wfrgk.75); asserted on the file on disk.
test('editing a status keeps its integer duration', async () => {
  const page = await open({ right: 420, selection: { kind: 'status', key: 'bleeding' } });
  const file = join(dir, 'showcase/areas/combat/statuses/bleeding.json');
  const tick = page.locator('#root_tick_every');
  await tick.fill('901');
  await tick.blur();
  const read = () => JSON.parse(readFileSync(file, 'utf8'));
  for (let t = 0; read().tick_every !== 901 && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual([read().tick_every, read().duration], [901, 1800]);
  await page.close();
});

// Breaks: picking another kind of an hour writes nothing over it, so the hour hides and the next
// write (another hour removed) drops it from the file (loka-wfrgk.74); asserted on the file on disk.
test('an hour switched to another kind survives a write elsewhere', async () => {
  const page = await open({ right: 420, selection: { kind: 'npc', key: 'warden' } });
  const schedule = page.locator('fieldset[aria-label="Schedule"]');
  const kind = schedule.getByRole('combobox', { name: '14 kind' });
  await kind.selectOption({ label: 'walk' });
  await schedule.getByRole('button', { name: 'remove hour 13' }).click();
  const file = join(dir, 'showcase/areas/low_wardle/npcs/warden.json');
  const read = () => JSON.parse(readFileSync(file, 'utf8')).daily_schedule;
  for (let t = 0; '13' in read() && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual(read(), { 14: { room: 'warden_gate', walks: true } });
  await page.close();
});
