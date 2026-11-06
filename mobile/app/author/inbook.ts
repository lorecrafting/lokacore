// size: allow 320, the field's open, save, put-back, walk keys and add-here menu share its state
// E5, prose in the Book (docs/design/prose-in-the-book-rulings.md): a double-click turns a line
// into its field, Cmd-Z puts back, `]`/`[` walk the `~` lines. Drawn over the Book from here:
// panel.tsx requires this only in the author preview, so a player build never holds it.
import type { Message } from './live.ts';
import { noFieldNote, oneLine, CSS, paletteNear, paper, saving, step } from './prose_rules.ts';
import { textField, unwritten, walk, selects, shortcut } from './prose_rules.ts';

export { tagged } from './prose_rules.ts';
type Hooks = {
  seen: Map<string, string>;
  said: Map<string, string>;
  tell: (sent: object) => void;
  redraw: () => void;
};
type At = { file: string; line: number; was: string; words: string };
type Field = { el: HTMLElement; kept: Node[]; shown: string; key: string; at: At; busy?: boolean };
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const enc = encodeURIComponent;
async function api(path: string, sent?: object): Promise<[number, any]> {
  const init = sent && { method: 'POST', body: JSON.stringify(sent) };
  const r = await fetch(`/__author${path}`, init);
  return [r.status, await r.json().catch(() => null)];
}
const typing = (t: EventTarget | null) => t instanceof HTMLElement && textField(t);

// One editor per page: its state lives here, set by start().
let hooks: Hooks = { seen: new Map(), said: new Map(), tell: () => {}, redraw: () => {} };
const edits: (At & { id: number; key: string; draft: string })[] = []; // /edit answers, its At
let unconfirmed = new Set<string>();
let field: Field | undefined;
let opening = false; // a /line in flight: a second double-click opens nothing
let landed: HTMLElement | undefined;
let selected: { kind: string; key: string; add?: string[] } = { kind: '', key: '' }; // the panel's selection: its lines are marked
let asked = false; // a Book click: the selection's add-here menu shows once the panel offers it
let counted = '';
let note: HTMLDivElement, spaced: HTMLElement | undefined; // spaced: the line the note sits under
const observer =
  typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(reapply);
const watch = () =>
  observer?.observe(document.body, { childList: true, subtree: true, characterData: true });
const lines = () =>
  [...document.querySelectorAll<HTMLElement>('[dir="auto"]')].filter((el) =>
    hooks.seen.has(el.textContent ?? ''),
  );

/** Writes `text` (and any buttons) under `el`; empty hides it. */
function say(
  el: HTMLElement | undefined,
  text = '',
  warn = false,
  buttons: [string, () => void][] = [],
) {
  note.replaceChildren(text, ...buttons.map(([name, run]) => button(name, run)));
  note.toggleAttribute('data-warn', warn);
  note.hidden = !el || !text;
  spaced?.style.removeProperty('margin-bottom');
  spaced = note.hidden ? undefined : el; // book-ui.md, No field: the lines below make room
  if (!el) return;
  const r = el.getBoundingClientRect();
  Object.assign(note.style, { left: `${r.left + scrollX}px`, top: `${r.bottom + scrollY}px` });
  if (spaced) el.style.marginBottom = `${note.offsetHeight}px`;
}
const button = (name: string, run: () => void) => {
  const b = document.createElement('button');
  b.textContent = name;
  b.onmousedown = (e) => e.preventDefault(); // the field keeps the focus, so no blur saves
  b.onclick = run;
  return b;
};
const open = (key: string, words: string) => void api('/open', { key, words });

/** The marks, after every Book render: `~` bars, unconfirmed lines, the palette, the counts. */
function reapply() {
  const all = lines();
  const p = paletteNear(paper(all[0] ?? document.body));
  for (const [role, ink] of Object.entries(p))
    document.documentElement.style.setProperty(`--loka-${role}`, ink);
  const todo = all.filter((el) => unwritten(el.textContent!));
  for (const el of all) {
    const marks = [
      unconfirmed.has(hooks.seen.get(el.textContent!)!) && 'unconfirmed',
      todo.includes(el) && 'still to write',
    ].filter(Boolean);
    el.toggleAttribute('data-loka-todo', todo.includes(el));
    el.toggleAttribute('data-loka-unconfirmed', marks.includes('unconfirmed'));
    el.toggleAttribute(
      'data-loka-selected',
      selects(hooks.seen.get(el.textContent!), selected.kind, selected.key),
    );
    if (marks.length) el.setAttribute('data-loka-a11y', marks.join(', '));
    else el.removeAttribute('data-loka-a11y');
  }
  if (landed && !landed.isConnected) landed = undefined;
  const counts = JSON.stringify({ here: todo.length, at: landed ? todo.indexOf(landed) + 1 : 0 });
  if (counts !== counted) hooks.tell({ todoHere: JSON.parse((counted = counts)) });
}
async function openField(el: HTMLElement) {
  const key = hooks.seen.get(el.textContent ?? '');
  if (!key || field || opening) return say(el, key ? '' : noFieldNote(undefined));
  opening = true;
  const [status, at] = await api(
    `/line?key=${enc(key)}&words=${enc(hooks.said.get(key) ?? '')}`,
  ).finally(() => (opening = false));
  el = el.isConnected ? el : lineOf(key)!; // a click's select render can remount it while /line waits
  if (!el) return;
  if (status !== 200) return say(el, noFieldNote(key, typeof at === 'string' ? at : undefined));
  field = { el, kept: [...el.childNodes], shown: el.textContent!, key, at }; // as drawn (a `~`'s marks too): React rewrites a change
  observer?.disconnect(); // the field is not a Book render
  el.replaceChildren(at.words);
  el.contentEditable = 'plaintext-only';
  el.setAttribute('data-loka-field', '');
  el.focus();
  getSelection()?.selectAllChildren(el);
  if (!unwritten(at.words)) getSelection()?.collapseToEnd(); // a bare `~` stays selected: typing replaces it
  el.addEventListener('keydown', onFieldKey);
  el.addEventListener('keyup', onFieldUp);
  el.addEventListener('beforeinput', onInput);
  el.addEventListener('blur', onBlur);
  caption();
}
const caption = () =>
  field && say(field.el, `${field.at.file}:${field.at.line}  Enter saves · Esc cancels`);
function close() {
  const { el, kept } = field!; // every caller holds the open field
  const had = document.activeElement === el; // not when a blur saved: focus stays where it went
  field = undefined;
  el.removeEventListener('keydown', onFieldKey);
  el.removeEventListener('keyup', onFieldUp);
  el.removeEventListener('beforeinput', onInput);
  el.removeEventListener('blur', onBlur);
  el.replaceChildren(...kept); // React's own nodes, so its next render finds them
  el.removeAttribute('contenteditable');
  el.removeAttribute('data-loka-field');
  el.tabIndex = -1;
  if (had) el.focus();
  say(undefined);
  watch();
  reapply();
  hooks.redraw(); // the words it held back while open
}
function onFieldKey(e: KeyboardEvent) {
  e.stopPropagation(); // the Book's keys are not the field's
  if (e.key === 'Escape') close();
  if (e.key !== 'Enter') return;
  e.preventDefault(); // one line: Enter saves, Shift-Enter does nothing
  if (!e.shiftKey) void save();
}
// a space's keyup would press a button around the line (a room title's) and blur the field
const onFieldUp = (e: KeyboardEvent) => e.key === ' ' && e.preventDefault();
function onInput(e: InputEvent) {
  if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') e.preventDefault();
  const text = e.dataTransfer?.getData('text/plain') ?? e.data;
  if (e.inputType === 'insertFromPaste' && text && oneLine(text) !== text) {
    e.preventDefault();
    document.execCommand('insertText', false, oneLine(text));
  }
}
const onBlur = () => void save();
async function save() {
  if (!field || field.busy) return;
  const f = field;
  const draft = oneLine(f.el.textContent ?? '');
  const choice = saving(draft, f.at.words);
  if (choice === 'unchanged') return close();
  if (choice === 'empty') return say(f.el, 'Empty. Write ~ to leave it unwritten.');
  f.busy = true;
  const { file, line, was } = f.at;
  const [status, answer] = await api('/edit', { file, line, was, words: draft, key: f.key });
  f.busy = false;
  if (status === 200) edits.push({ ...f.at, id: answer.id, key: f.key, draft });
  if (field !== f) return; // closed (Esc), or another line opened, while it saved
  if (status === 200) return close();
  if (status === 409) return conflict(f);
  say(f.el, typeof answer === 'string' ? answer : `Not saved (${status}).`, true);
}
/** The disk's line differs from the field's: theirs, Keep mine, Take theirs; or Open source. */
async function conflict(f: Field) {
  const [status, theirs] = await api(`/line?key=${enc(f.key)}&words=${enc(f.at.words)}`);
  if (field !== f) return;
  if (status !== 200)
    return say(f.el, 'Changed on disk since you opened it.', true, [
      ['Open source', () => open(f.key, f.at.words)],
    ]);
  say(f.el, `Changed on disk since you opened it. ${theirs.words}`, true, [
    ['Keep mine', () => ((f.at = theirs), void save())],
    ['Take theirs', close],
  ]);
}

async function putBack() {
  const last = edits.pop();
  if (!last) return hooks.tell({ note: 'Nothing of yours to put back.' });
  const [status] = await api('/undo', last); // its key and old words: the Book shows them at once
  if (status === 200) return hooks.tell({ note: `put back ${last.file}:${last.line}` });
  if (status === 409) edits.push(last); // still the latest of yours: put back after a fix
  hooks.tell({
    note: `${last.file} changed since; not put back.`,
    open: { key: last.key, words: last.draft },
  });
}
/** A Book key outside any field: walk, Enter on the landed line, Cmd-Z. */
function onKey(e: KeyboardEvent, inField = typing(e.target), relayed = false) {
  const asks = !relayed && shortcut(e);
  // the panel's, though the Book has the focus
  if (asks) return void (e.preventDefault?.(), hooks.tell({ shortcut: asks }));
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z' && !inField) {
    e.preventDefault?.();
    return void putBack();
  }
  const onLanded = relayed || e.target === document.body || e.target === landed; // not a choice's Enter
  if (e.key === 'Enter' && landed && !inField && onLanded) {
    e.preventDefault?.();
    return void openField(landed);
  }
  const asked = walk(e, inField);
  if (!asked) return;
  const [todoOnly, by] = asked;
  const list = lines().filter((el) => !todoOnly || unwritten(el.textContent!));
  landed?.removeAttribute('data-loka-landed');
  landed = list[step(list.length, landed ? list.indexOf(landed) : -1, by)];
  landed?.setAttribute('data-loka-landed', '');
  landed?.scrollIntoView({ block: 'nearest' });
  reapply();
}
const onDouble = (e: MouseEvent) => {
  if (field?.el.contains(e.target as Node)) return; // a word picked in the field
  let el = e.target as HTMLElement | null;
  while (el && el !== document.body && !hooks.seen.has(el.textContent ?? '')) el = el.parentElement;
  void openField(el && el !== document.body ? el : (e.target as HTMLElement));
};
const hush = () => field || say(undefined); // a note lasts until the next click or key
/** The add-here menu under the selected line (Book UI "Author mode (dev only)"): a pick goes to the panel's card. */
function offer() {
  const el = lines().find((l) => l.hasAttribute('data-loka-selected'));
  if (!asked || !el || !selected.add?.length) return;
  asked = false;
  const room = selected.key;
  say(
    el,
    'Add here',
    false,
    selected.add.map((f) => [f, () => hooks.tell({ add: { kind: f, room } })]),
  );
}
const onClick = (e: Event) => {
  asked = lines().some((l) => l.contains(e.target as Node)); // a Book line asks; the menu, nothing
  hush(); // (it empties the note)
  if ((e.target as Element).closest?.('[data-loka-selected]')) offer();
  if (!landed) return;
  landed.removeAttribute('data-loka-landed');
  landed = undefined; // Enter is the page's again
  reapply();
};
const onRelay = (e: MessageEvent) => {
  if (!LOCAL.test(e.origin)) return;
  if (e.data?.op === 'key') onKey(e.data, !!field, true); // an open field holds the keys
  if (e.data?.op === 'select') ((selected = e.data), reapply(), offer()); // {kind, key, add?}
  if (e.data?.op === 'edit') edit(String(e.data.key));
};
const lineOf = (key: string) => lines().find((l) => hooks.seen.get(l.textContent!) === key);
/** Opens the field of text key `key`'s line; one not on this page opens in the owner's editor. */
function edit(key: string) {
  const el = lineOf(key);
  if (el) return void openField(el);
  hooks.tell({ note: `${key} is not on this page; opened in your editor.` });
  open(key, hooks.said.get(key) ?? '');
}
/** The words a Book render shows for `key`: the open field's, held until it closes, else undefined. */
export const frozen = (key: string) => (field?.key === key ? field.shown : undefined);
/** Tells the counts again (a panel that just said hello missed them). */
export function recount() {
  counted = '';
  reapply();
}
/** A pushed message (panel.tsx's stream): unconfirmed lines, and a change under the field. */
export function heard(message: Message) {
  unconfirmed = new Set((message.unconfirmed ?? []).map((u) => u.key));
  const f = field;
  if (f && !f.busy && message.changed?.some((c) => c.file === f.at.file))
    void api(`/line?key=${enc(f.key)}&words=${enc(f.at.words)}`).then(([, now]) => {
      if (now?.was !== f.at.was) void conflict(f); // their line differs: the notice opens unasked
    });
  reapply();
}
const on: [EventTarget, string, EventListener][] = [
  [document, 'dblclick', onDouble as EventListener],
  [document, 'keydown', onKey as EventListener],
  [document, 'click', onClick],
  [document, 'keyup', hush],
  [window, 'message', onRelay as EventListener],
];

/** Starts the editor over the Book; the returned function stops it. */
export function start(given: Hooks) {
  hooks = given;
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = CSS;
  note = document.body.appendChild(document.createElement('div'));
  note.className = 'loka-note';
  note.setAttribute('role', 'status'); // polite
  for (const [target, name, run] of on) target.addEventListener(name, run, true);
  watch();
  reapply();
  return () => {
    for (const [target, name, run] of on) target.removeEventListener(name, run, true);
    observer?.disconnect();
    style.remove();
    say(undefined); // gives the line its margin back
    note.remove();
  };
}
