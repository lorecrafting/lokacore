// The Book's own control and section words (Control's and Page's doc comments):
// the same in every cartridge, so not text keys, and not kernel codes (words.ts). Components, e2e
// tests, the walkthrough and story routes all name a control through this table; it imports
// nothing, so the e2e runner can load it. lint/rules/mobile-book-labels.yml lists these words too;
// lint/rules/mobile-book-english.yml keeps a page's English here.
export const LABEL = {
  itemPop: (names: string[]) => names.map((n) => `+ ${n}`).join(', '),
  leave: 'Leave',
  leaveConversation: 'Leave the conversation',
  back: 'Back',
  backToWorld: 'Back to World',
  backToContents: 'Back to Contents',
  backToBoard: 'Back to board',
  backToSettings: 'Back to Settings',
  close: 'Close',
  resumeDream: 'Resume dream',
  gotIt: 'Got it',
  startOver: 'Start over',
  tryAgain: 'Try again',
  backspace: 'Backspace',
  clear: 'Clear',
  submit: 'Submit',
  // The Start over confirmation (App.tsx).
  startOverAsk: 'Start over?',
  startOverLoses: 'Your saved game will be lost.',
  cancel: 'Cancel',
  inside: 'Inside',
  // An open container's Inside page: the item page's control and the empty page's note.
  lookInside: 'Look inside',
  nothingInside: 'There is nothing inside.',
  // A person's page control to their Look page (loka-aqnc).
  lookPerson: 'Look',
  held: 'Held',
  // Take, on an item a living NPC holds (pass-1 E14).
  lift: 'Lift',
  worn: 'Worn',
  askWhere: 'Ask where',
  // Before a topic's authored label on an NPC's card (row FD7).
  askAbout: 'Ask about',
  lore: 'Lore',
  // The Journal's Chronicle and its day headings (toolbox row FD6; wording pending designer).
  chronicle: 'Chronicle',
  day: 'Day',
  notHere: 'Not here',
  // The away recap's heading (toolbox row W27; wording pending designer, loka-x6t.14).
  awayRecap: 'While you were away',
  // The word field's sends (the Realm's room speech, loka-evzt); the Character page's Spells.
  say: 'Say',
  shout: 'Shout',
  cast: 'Cast',
  aWord: 'A word',
  oneWord: 'One word, letters only.',
  spells: 'Spells',
  // The Contents section of held and worn things (owner 2026-10-15, loka-x6t.55).
  inventory: 'Inventory',
  // The effect settings (docs/system/book-ui.md, Effects, sound and haptics).
  sound: 'Sound',
  music: 'Music',
  haptics: 'Haptics',
  flashes: 'Flashes',
  credits: 'Credits',
  on: 'On',
  off: 'Off',
  readingSize: 'Reading size',
  readingStandard: 'Standard',
  readingLarge: 'Large',
  readingLarger: 'Larger',
  // The Pick list options (book-ui.md, Pick a second thing; owner 2026-10-23).
  useAnItem: 'Use an item…',
  useOn: 'Use on…',
  giveAnItem: 'Give an item…',
  giveTo: 'Give to…',
  castASpell: 'Cast a spell…',
  castOn: 'Cast on…', // a Character Spells line's list of the aimed spell's targets (loka-x6t.109.5)
  // The NPC page's Talk and shop cards, the shop page's Sell card (owner picks mvlrlvappy4w, mvlymuams73l).
  talk: 'Talk',
  trade: 'Trade',
  sell: 'Sell',
  yourOrder: 'Your order',
  // A foe's definite article on the Combat page, "the goblin" (loka-6qi).
  the: 'the',
  // Page titles and the Contents lines (Menu.tsx, sections.tsx, journal.tsx; loka-x6t.61).
  contents: 'Contents',
  character: 'Character',
  map: 'Map',
  journal: 'Journal',
  settings: 'Settings',
  item: 'Item',
  chooseAncestry: 'Choose your ancestry',
  chooseOnce: 'Choose once before your story begins.',
  continue: 'Continue',
  // A page's empty states and notes (sections.tsx, journal.tsx).
  nothingKnown: 'Nothing is known about you yet.',
  saveNotConfirmed: 'save not confirmed',
  carryingNothing: 'You are carrying nothing.',
  empty: 'Empty',
  noWayOut: 'No way out is known.',
  nothingWritten: 'Nothing written yet.',
  currentPlace: (place: string) => `Current place: ${place}`,
  // A Map drawing's open dot: its caption and its accessible name.
  unexplored: 'Unexplored',
  unexploredExit: (direction: string, from: string) =>
    `Unexplored, ${AT[direction] ?? `${direction} of`} ${from}`,
  // A quest's patrol and expedition lines on the Journal page.
  patrolProgress: (credit: number, required: number, status: string) =>
    `${credit} of ${required} checkpoints. ${status}.`,
  patrolAt: (leader: string, room: string) => `${leader} is at ${room}.`,
  // A person's condition on their Look page (book-ui.md, NPC page): the hp band phrase.
  looksToBe: (name: string, band: string) => `${name} looks to be ${band}.`,
  patrolWalk: (direction: string) => `Walk ${direction} to join him.`,
  patrolRejoin: (leader: string) => `Return to ${leader} and choose Rejoin.`,
  patrolRestart: (leader: string) => `Return to ${leader} and choose Restart now.`,
  patrolNext: (title: string) => `Next: ${title}.`,
  expeditionProgress: (cursor: number, required: number) => `${cursor} of ${required} entries.`,
  shelterUsed: 'Shelter used.',
  hint: (hint: string) => `Hint: ${hint}`,
  look: (title: string) => `${title}, look`,
  // A shop line (book-ui.md, shop lines): shown "A cob of bread, 4p.", its name adds "Buy for 4 pennies.".
  shopLine: (thing: string, price: number) => `${thing}, ${price}p.`,
  pennies: (n: number) => (n === 1 ? '1 penny' : `${n} pennies`),
  buyFor: (n: number) => `Buy for ${LABEL.pennies(n)}.`,
  sellFor: (n: number) => `Sell for ${LABEL.pennies(n)}.`,
} as const;

// A collapsed group's count in the room sentence, "two crows", from two; digits from 10 (loka-6qi).
export const COUNT: readonly string[] = [
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];
// An up or down way's place word: "above", "below" ("The door below is locked.").
export const AT: Record<string, string> = { up: 'above', down: 'below' };
