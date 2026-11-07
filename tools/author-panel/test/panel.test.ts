// The author panel in a browser (loka-wfrgk.41): the real panel, served by its Vite server against
// `bin/loka dev --watch` on the toolbox showcase, in stable Chrome (the runner image has it, as the
// Storybook jobs use). A new check: a test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
// size: allow 700, every panel E2E shares harness.ts's one Vite + bin/loka dev server pair and Chrome
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import axe from 'axe-core';
import { author, boot, dir, open, QUEST } from './harness.ts';
import type { Route } from 'playwright';

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
// a words field (Quest.tsx's words), a dialogue's words list a field it lacks, a choice's then_failed row shows without a check (or hides
// with one), a known target is not drafted, or a choice's link
// takes a dialogue the story lacks (refuseLink not wired, or the refused text drafted and committed):
// the compile's UNRESOLVED_REFERENCE.
test('a quest and a dialogue open their cards; a link to no dialogue is refused', async () => {
  const quest = await open(QUEST);
  await quest.locator('[aria-label="quest card"]').waitFor({ timeout: boot });
  const named = quest.locator('[aria-label="quest card"] [aria-label="words"] input');
  await named.first().waitFor({ timeout: boot });
  assert.equal(await named.count(), 1); // its own name: a words field, never a Book link
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
  // its words keep the form's widgets: a words field (fields.tsx TextKey)
  await boast.locator('input[aria-label$=" words"]').first().waitFor({ timeout: boot });
  // bess_talk.json's boast: check and steps are removable rows; label and narration, its words, never
  const shown = await boast.locator('span.flex-1').allTextContents();
  assert.deepEqual(shown.sort(), ['check', 'steps']);
  await boast.getByRole('button', { name: 'Rename' }).click();
  await boast.getByText("a choice's key is its id").waitFor({ timeout: boot });
  await bess.close();
  const page = await open({ right: 280, selection: { kind: 'dialogue', key: 'aldous_talk' } });
  const link = page.getByLabel('bounty then');
  await link.waitFor({ timeout: boot });
  const words = page.locator('[aria-label="dialogue card"] [aria-label="words"] input');
  await words.first().waitFor({ timeout: boot });
  assert.deepEqual(await words.evaluateAll((l) => l.map((e) => e.ariaLabel)), ['prompt words']); // aldous_talk.json has a prompt and no name of its own
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
    await r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...s, bytes: JSON.stringify(doc) }),
    });
  });
  const bounty = page.locator('[aria-label="choice bounty"]');
  await bounty.locator('summary').click();
  await page.getByLabel('bounty then').fill('aldous_lesson');
  const set = bounty.locator('[aria-label="nested aldous_lesson"]');
  await set.waitFor({ timeout: boot });
  const keys = await set.locator('code').allTextContents();
  assert.deepEqual(keys.slice(0, 2), [
    'dialogue.aldous_lesson.prompt',
    'dialogue.aldous_lesson.learn',
  ]);
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
    await r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...s, bytes: JSON.stringify(doc) }),
    });
  });
  await page.reload(); // the card read its source before the route
  const praise = page.locator('[aria-label="choice praise"]');
  await praise.locator('summary').click();
  const row = praise.locator('span.flex-1').getByText('hand_over', { exact: true });
  await row.locator('..').getByRole('button', { name: 'Remove' }).first().click();
  await row.waitFor({ state: 'detached', timeout: boot }); // the old gate kept it, refused
  assert.equal(await page.getByText('then_failed needs a check').count(), 0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close();
});

// Breaks (Generic.tsx useCard, loka-wfrgk.63): a held edit's refusal outliving the edit taken back;
// Undo rebasing the held draft onto the undone file; reselecting the card dropping its Undo; a
// refused write clearing the last write's Undo; a failed save (500 text) not shown; an error the
// file already has holding every edit to its field (the #675 rule: only a new error holds).
test('a held edit gives way to its undoing, Undo and a reselect', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'oilskin' } });
  const file = join(dir, 'showcase/areas/fell_road/items/oilskin.json');
  const mass = () => JSON.parse(readFileSync(file, 'utf8')).mass_grams;
  const field = page.locator('#root_mass_grams');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const refusal = page.getByText('mass_grams must be >= 0'); // the held line, not rjsf's own
  const set = async (v: string) => (await field.fill(v), await field.blur());
  await field.waitFor({ timeout: boot });
  await set('600');
  for (let t = 0; mass() !== 600 && t < 50; t++) await page.waitForTimeout(100);
  await undo.waitFor({ timeout: boot });
  await page.getByRole('button', { name: 'World', exact: true }).click();
  await page.getByRole('button', { name: 'oilskin · an oilskin coat', exact: true }).click();
  await undo.waitFor({ timeout: boot }); // the reselected card keeps its last write's Undo
  await field.waitFor({ timeout: boot });
  await set('-1');
  await refusal.waitFor({ timeout: boot });
  await set('600'); // the held edit taken back: nothing to send, nothing held
  await refusal.waitFor({ state: 'detached', timeout: boot });
  await page.route('**/__author/change', (r) => r.fulfill({ status: 409, json: 'refused here' }));
  await set('700');
  await page.getByText('refused here').waitFor({ timeout: boot });
  await page.route('**/__author/change', (r) => r.fulfill({ status: 500, body: 'boom' })); // not JSON
  await set('800');
  await page.getByText('"boom" is not valid JSON').waitFor({ timeout: boot }); // shown, not swallowed
  assert.equal(await field.inputValue(), '800'); // the draft held, not reloaded
  await page.unroute('**/__author/change');
  assert.ok(await undo.isVisible()); // the refused write wrote nothing: the last Undo stands
  await set('-1');
  await refusal.waitFor({ timeout: boot });
  await undo.click();
  for (let t = 0; mass() !== 500 && t < 50; t++) await page.waitForTimeout(100);
  assert.equal(mass(), 500);
  for (let t = 0; (await field.inputValue()) !== '500' && t < 50; t++) await page.waitForTimeout(100); // the reload rendered
  assert.equal(await field.inputValue(), '500'); // not the held -1 put back
  assert.equal(await refusal.count(), 0);
  assert.ok(await undo.isDisabled()); // an undone write offers no Undo of the undo
  await page.route('**/__author/change', (r) => r.abort());
  await page.route('**/__author/source?file=*oilskin*', async (r) => {
    const s = await (await r.fetch()).json();
    const doc = { ...JSON.parse(s.bytes), keywords: ['oilskin', 'Bad Word'] };
    await r.fulfill({ json: { ...s, bytes: JSON.stringify(doc) } });
  });
  await page.reload();
  const keyword = page.locator('#root_keywords_0');
  await keyword.waitFor({ timeout: boot });
  const sent = page.waitForRequest('**/__author/change', { timeout: boot });
  await keyword.fill('oilcloth');
  await keyword.blur();
  assert.deepEqual((await sent).postDataJSON().ops, [{ path: ['keywords', 0], value: 'oilcloth' }]); // the file's own Bad Word holds nothing
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close();
});

// Breaks: an added capability row starts at a key the schema refuses, or its renamed key is never written.
test('an added capability row starts at a registry key and its rename writes', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'oilskin' } });
  const file = join(dir, 'showcase/cartridge.json');
  const before = readFileSync(file);
  const caps = () => JSON.parse(readFileSync(file, 'utf8')).requires.capabilities;
  await page.getByRole('button', { name: 'World', exact: true }).click();
  const box = page.locator('#root_requires_capabilities');
  await box.waitFor({ timeout: boot });
  await box.getByRole('button', { name: 'Add', exact: true }).last().click();
  // the row starts at dev, the registry's first capability the cartridge does not list
  const key = page.locator('#root_requires_capabilities_dev-key');
  await key.fill('tide');
  await key.press('Tab');
  for (let t = 0; caps().tide === undefined && t < 50; t++) await page.waitForTimeout(100);
  const now = caps();
  writeFileSync(file, before); // tide is not installed: the later tests need a cartridge that compiles
  assert.deepEqual([now.tide, now.dev, now.newKey], [1, undefined, undefined]);
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
  // Break: no sign while the fights run, a click then starts another, a retry keeps the last answer (loka-wfrgk.79).
  // Break: Run fights waits on the pacing sim too, minutes on the showcase (review 683 #2).
  let paced = 0;
  for (const route of ['fights', 'numbers'])
    await page.route(`**/__author/${route}`, async (r) => {
      paced += route === 'numbers' ? 1 : 0;
      await new Promise((d) => setTimeout(d, 800));
      await r.fulfill({ json: { fights: { why: 'no world' } } });
    });
  const combat = page.locator('[aria-label="Combat attack"]');
  for (const run of [1, 2]) {
    await combat.getByRole('button', { name: 'Run fights' }).click();
    await combat.getByText('running the fights').waitFor({ timeout: 500 });
    assert.ok(
      await combat.getByRole('button', { name: 'Run fights' }).isDisabled(),
      `run ${run}: one at a time`,
    );
    assert.equal(await combat.getByText('no world').count(), 0, `run ${run}`);
    await combat.getByText('no world').waitFor();
  }
  assert.equal(await page.getByRole('button', { name: 'Run fights' }).count(), 1); // not on hp
  assert.equal(paced, 0, 'Run fights asked for the pacing sim');
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
    await page.getByLabel(`${kind} card`).getByLabel('Add a field').click();
    const options = await page.getByRole('menuitem').locator('span:first-child').allTextContents();
    assert.ok(options.includes(field), `${kind} ${key} offers ${field}`);
    // a scripted action is never offered a command action's field (UNKNOWN_FIELD)
    assert.ok(!options.includes('accessibility'), `${kind} ${key} offers accessibility`);
    if (kind === 'action') {
      // Break: an added prose field is only revealed, never written (loka-wfrgk.24): it writes its key `~`
      await page.getByRole('menuitem').filter({ has: page.getByText(field, { exact: true }) }).click();
      const tip = () =>
        JSON.parse(readFileSync(join(dir, 'showcase/actions/fish.json'), 'utf8')).tip;
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
  const file = join(dir, 'showcase/areas/low_wardle/npcs/warden.json');
  const read = () => JSON.parse(readFileSync(file, 'utf8')).daily_schedule;
  const other = Object.keys(read()).findLast((h) => h !== '13')!; // 14, or 15 after the NPC card test
  const page = await open({ right: 420, selection: { kind: 'npc', key: 'warden' } });
  const schedule = page.locator('fieldset[aria-label="Schedule"]');
  await schedule.getByRole('combobox', { name: `${other} kind` }).selectOption({ label: 'walk' });
  await schedule.getByRole('button', { name: 'remove hour 13' }).click();
  for (let t = 0; '13' in read() && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual([read()[13], read()[other]], [undefined, { room: 'warden_gate', walks: true }]);
  await page.close();
});

// Breaks: removing a room's last variant leaves `variants: []`, refused by minItems 1, or rjsf's
// Remove, leaving no focus, never blurs: either way nothing is written and Undo replays an older
// change (loka-wfrgk.78); asserted on the file on disk.
test("removing a room's last variant writes it gone, and Undo brings it back", async () => {
  const page = await open({ right: 420, selection: { kind: 'room', key: 'sea_cave' } });
  const file = join(dir, 'showcase/areas/tidewater/rooms/sea_cave.json');
  const read = () => JSON.parse(readFileSync(file, 'utf8'));
  const was = read().variants;
  await page.locator('#root_variants').getByRole('button', { name: 'Remove' }).click();
  for (let t = 0; 'variants' in read() && t < 50; t++) await page.waitForTimeout(100);
  assert.equal('variants' in read(), false);
  await page.getByRole('button', { name: 'Undo' }).click();
  for (let t = 0; !('variants' in read()) && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual(read().variants, was);
  await page.close();
});

// Breaks: a detail added on the Room card is held refused (no description or alias; the Book's
// Edit answers "not on this page"), or opens with every optional sub-field drawn (loka-wfrgk.76), or
// a folded field leaves its fold on the first keystroke and drops the next ones, or a write behind one
// in flight (CPU slowed as on CI: the summary's blur writes `1` mid-typing) or an Undo sent stale.
test('a new room detail saves with a `~` description, its optional fields folded', async () => {
  const page = await open({ right: 420, selection: { kind: 'room', key: 'sea_cave' } });
  await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const file = join(dir, 'showcase/areas/tidewater/rooms/sea_cave.json');
  const was = readFileSync(file, 'utf8');
  const well = () => JSON.parse(readFileSync(file, 'utf8')).details.well;
  await page.locator('#root_details__add').click();
  await page.locator('#root_details_newKey-key').fill('well');
  await page.keyboard.press('Tab');
  for (let t = 0; !well() && t < 50; t++) await page.waitForTimeout(100);
  assert.deepEqual(well(), { aliases: ['well'], description: { prose: '~' } });
  assert.equal(await page.locator('#root_details_well_bed').isVisible(), false);
  // a folded field typed into stays in its fold with the focus: each key lands
  const rating = page.locator('#root_details_well_rating');
  await page.locator('details', { has: rating }).locator('summary').click();
  await rating.pressSequentially('12', { delay: 50 });
  await page.keyboard.press('Tab');
  for (let t = 0; well().rating !== 12 && t < 50; t++) await page.waitForTimeout(100);
  assert.equal(well().rating, 12);
  await rating.fill('123'); // and Undo clicked while its write is in flight undoes it once it lands
  await page.keyboard.press('Tab');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await Promise.all([page.waitForResponse((r) => r.url().includes('/__author/undo')), undo.click()]);
  await page.waitForTimeout(2000);
  assert.equal(well().rating, 12);
  writeFileSync(file, was);
  await page.close();
});

// Breaks: a one-way toggle writes only the far room, so neither room's card Undo knew of it: Undo
// did nothing or undid an older change, and the reverse exit stayed gone (loka-wfrgk.77).
test("a one-way exit's reverse comes back by Undo on either room's card", async () => {
  const page = await open({ right: 420, selection: { kind: 'room', key: 'cliff_path' } });
  const file = join(dir, 'showcase/areas/tidewater/rooms/cliff_top.json');
  const south = () => 'south' in JSON.parse(readFileSync(file, 'utf8')).exits;
  const toggle = async (gone: boolean) => {
    for (let t = 0; south() === gone && t < 50; t++) await page.waitForTimeout(100);
    assert.equal(south(), !gone);
  };
  const row = page.getByLabel('Exits').locator('div', { hasText: 'north → cliff_top' });
  await row.getByRole('button', { name: 'One-way' }).click();
  await toggle(true);
  await page.getByRole('button', { name: 'Undo' }).click();
  await toggle(false);
  await row.getByRole('button', { name: 'One-way' }).click();
  await toggle(true);
  await page.keyboard.press('Control+k');
  await page
    .getByLabel('Find a key, a ~ or a command')
    .pressSequentially('cliff_top', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.locator('[aria-label="Room card"] code', { hasText: 'cliff_top.json' }).waitFor();
  await page.getByRole('button', { name: 'Undo' }).click();
  await toggle(false);
  await page.close();
});

// Breaks: palette New sends a kind the server does not know, hides its refusal (loka-wfrgk.60) or
// asks for a key (loka-wfrgk.101), or Delete sends another file, a row key with a definition file, an unread
// `was`, or hides the refusal.
test('palette New and Delete send the starter and the selected file; refusals show', async () => {
  const page = await open(QUEST);
  const sent: unknown[] = [];
  const told: string[] = [];
  const asked: string[] = [];
  page.on('dialog', (d) => {
    if (d.type() === 'prompt') return void (asked.push(d.message()), d.accept('zz'));
    told.push(d.message());
    void d.accept();
  });
  await page.route(/\/__author\/(new|delete)$/, (r) => {
    sent.push([new URL(r.request().url()).pathname, r.request().postDataJSON()]);
    return r.fulfill({ status: 400, json: 'refused here' });
  });
  const run = async (command: string, alerts: number) => {
    await page.keyboard.press('Control+k');
    await page.getByLabel('Find a key, a ~ or a command').fill(command);
    await page.keyboard.press('Enter');
    for (let i = 0; told.length < alerts; i++) {
      assert.ok(i < 100, `alert ${alerts} never shown after ${command}: ${told}`);
      await page.waitForTimeout(50);
    }
  };
  await run('New room', 1);
  await run('Delete the selected definition', 2);
  await page.route('**/__author/source?file=*', (r) => r.fulfill({ status: 404, json: {} }));
  await run('Delete the selected definition', 3);
  await run('New outline', 4); // one outline per world: no key asked
  const file = 'quests/carry_letter.json';
  const was = createHash('sha256')
    .update(readFileSync(join(dir, 'showcase', file)))
    .digest('hex');
  assert.deepEqual(sent, [
    ['/__author/new', { kind: 'rooms', name: 'room_1' }],
    ['/__author/delete', { file, was }],
    ['/__author/new', { kind: 'outline', name: 'outline' }],
  ]);
  assert.deepEqual(told, ['refused here', 'refused here', `${file}: not found`, 'refused here']);
  assert.deepEqual(asked, []); // a free key, no prompt
  await page.close();
});

// Breaks: a palette Delete's journal entry is undone from nowhere in the GUI, so only git brings the
// file back (loka-wfrgk.92), or a second Undo undoes that undo and deletes the file again.
test('palette Undo brings back the file palette Delete removed, once', async () => {
  const page = await open({ selection: { kind: 'reaction', key: 'boar_gore' } });
  const file = join(dir, 'showcase/areas/combat/reactions/boar_gore.json');
  const bytes = readFileSync(file, 'utf8');
  const told: string[] = [];
  page.on('dialog', (d) => void (told.push(d.message()), d.accept()));
  const run = async (command: string, until: () => boolean) => {
    await page.keyboard.press('Control+k');
    await page.getByLabel('Find a key, a ~ or a command').fill(command);
    await page.keyboard.press('Enter');
    for (let t = 0; !until() && t < 50; t++) await page.waitForTimeout(100);
  };
  try {
    await run('Delete the selected definition', () => !existsSync(file));
    assert.equal(existsSync(file), false, `not deleted: ${told}`);
    const down = (r: Route) => r.fulfill({ status: 500, body: '"no journal"' }); // shown, not thrown
    await page.route('**/__author/journal', down, { times: 1 });
    await run('Undo the last edit', () => told.length > 0);
    const refuse = (r: Route) => r.fulfill({ status: 409, body: '{}' }); // changed since: refused
    await page.route('**/__author/undo', refuse, { times: 1 });
    await run('Undo the last edit', () => told.length > 1);
    const both = ['no journal', 'Changed outside: try again'];
    assert.deepEqual([told, existsSync(file)], [both, false]);
    await run('Undo the last edit', () => existsSync(file));
    assert.equal(readFileSync(file, 'utf8'), bytes, `not brought back: ${told}`);
    await run('Undo the last edit', () => !existsSync(file)); // the Book's Cmd-Z, not the journal's
    assert.equal(existsSync(file), true, 'the second Undo deleted it again');
  } finally {
    writeFileSync(file, bytes); // the later tests share this cartridge
  }
  await page.close();
});

// Last: it switches the world. Breaks: a `.scene` dialogue routed to no card or the generic one, a
// value line without its picker or its verb's keys, a words line without its words field, an unknown
// key or the line's own value sent, Enter not sending, a refusal or a write's Undo not shown, or a
// modal scene's treatment shown as none, or then: offering an unlinkable dialogue (Scene.tsx's
// context.unlinkable dropped).
test('a .scene dialogue opens its text card: a picker per value line, words in place', async () => {
  appendFileSync(join(dir, 'identity_sampler/scenes/stranger_talk.scene'), '  then: end\n'); // line 7
  // the block tests' last write compiled first: a switch mid-compile leaves this card unopened
  const at = (f: string) => statSync(join(dir, f)).mtimeMs;
  const last = Math.max(
    ...readdirSync(join(dir, 'showcase'), { recursive: true }).map((f) => at(`showcase/${f}`)),
  );
  for (let t = 0; at('current.json') < last && t < 100; t++)
    await new Promise((r) => setTimeout(r, 100));
  const world = { method: 'POST', body: JSON.stringify({ name: 'identity_sampler' }) };
  assert.equal((await fetch(`http://localhost:${author}/world`, world)).status, 200);
  const page = await open({ selection: { kind: 'dialogue', key: 'stranger_talk' } }, 'line 1 npc');
  const npc = page.getByLabel('line 1 npc');
  assert.equal(await npc.inputValue(), 'stranger');
  const card = page.getByLabel('scene card');
  assert.equal(await card.locator('input[aria-label$=" words"]').count(), 2); // lines 3, 6
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
    r.fulfill({
      response: res,
      json: { ...(await res.json()), unlinkable: { stranger_talk: 'keyword' } },
    });
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
